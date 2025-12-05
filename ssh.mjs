import {Client} from 'ssh2';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

class SSHSandboxManager {
    constructor(options = {}) {
        this.sshPort = options.sshPort || process.env.SSH_PORT || 22;
        this.sshHost = options.sshHost || process.env.HOST_DOMAIN || 'localhost';
        this.containerHost = options.containerHost || process.env.SSH_CONTAINER_HOST || 'ssh-sandbox';
        this.containerPort = options.containerPort || 22;
        this.adminUsername = options.adminUsername || process.env.SSH_ADMIN_USER || 'root';
        this.adminPrivateKeyFile = options.adminPrivateKeyFile || process.env.SSH_ADMIN_PRIVATE_KEY_FILE || '/root/.ssh/id_rsa';
        this.usersBasePath = options.usersBasePath || process.env.USERS_BASE_PATH || '/users';
        this.logger = options.logger;
    }
    
    /**
     * Execute a command via SSH on the SSH container
     */
    async execSSH(command) {
        if(!this.adminPrivateKey){
            this.adminPrivateKey = await fs.readFile(this.adminPrivateKeyFile)
        }

        const conn = new Client();
        let output = '';
        let errorOutput = '';
        
        let promise = new Promise((resolve, reject) => {
            conn.on('ready', () => {
                conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                stream.on('close', (code) => {
                    conn.end();
                    if (code === 0) {
                    resolve({ stdout: output.trim(), stderr: errorOutput.trim() });
                    } else {
                    reject(new Error(`Command failed with code ${code}: ${errorOutput || output}`));
                    }
                });

                stream.on('data', (data) => {
                    output += data.toString();
                });

                stream.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                });
            });

            conn.on('error', (err) => {
                reject(new Error(`SSH connection failed: ${err.message}`));
            });

        });
        conn.connect({
            host: this.containerHost,
            port: this.containerPort,
            username: this.adminUsername,
            privateKey: this.adminPrivateKey,
            readyTimeout: 10000
        });

        await promise;
    }

    /**
     * Check if SSH container is accessible
     */
    async isContainerAccessible() {
        try {
            await this.execSSH('echo "test"');
            return true;
        } catch (error) {
            this.logger.error('SSH container is not accessible: %o', error.message);
            return false;
        }
    }

      /**
     * Check if a user exists
     */
    async userExists(userId) {
        try {
            const username = `${userId}`;
            await this.execSSH(`id ${username}`);
            return true;
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            return false;
        }
    }

    /**
     * Create a new SSH user
     */
    async createUser(userId, password = null) {
        // Check if container is accessible
        const isAccessible = await this.isContainerAccessible();
        if (!isAccessible) {
            throw new Error('SSH container is not accessible');
        }
        const username = `${userId}`;

        // Check if user already exists
        if (await this.userExists(userId)) {
            return {
                username,
                port: this.sshPort
            };
        }

        const userPassword = password || this.generatePassword();
        const userHomeInContainer = `/users/apps/${userId}`;

        // Create user in container via SSH
        const createUserCommand = `
        useradd --home-dir ${userHomeInContainer} ${username} && \
        echo "${username}:${userPassword}" | chpasswd && \
        chown -R ${username} ${userHomeInContainer} && \
        mkdir -p ${userHomeInContainer}/.ssh && \
        chmod 700 ${userHomeInContainer}/.ssh && \
        chown ${username}:${username} ${userHomeInContainer}/.ssh
        `;

        try {
            await this.execSSH(createUserCommand);
            this.logger.info(`✅ User ${username} created successfully`);
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }

        return {
            username,
            password: userPassword,
            port: this.sshPort
        };
    }

    async adjustFilePermissions(userId, filePath) {
        const username = `${userId}`;
        const userHomeInContainer = `/users/apps/${userId}`;
        const fullPathInContainer = `${userHomeInContainer}/${filePath.replace(/^\/+/, '')}`;

        try {
            await this.execSSH(`chown ${username} ${fullPathInContainer}`);
            this.logger.info(`✅ Permissions adjusted for ${fullPathInContainer}`);
        } catch (error) {
            throw new Error(`Failed to adjust file permissions: ${error.message}`);
        }
    }


    /**
     * Change user password
     */
    async changeUserPassword(userId, newPassword) {
        const isAccessible = await this.isContainerAccessible();
        if (!isAccessible) {
            throw new Error('SSH container is not accessible');
        }

        if (!await this.userExists(userId)) {
            throw new Error(`User '${userId}' does not exist`);
        }

        const username = `${userId}`;
        
        try {
            await this.execSSH(`echo "${username}:${newPassword}" | chpasswd`);
            this.logger.info(`✅ Password changed for ${username}`);
        } catch (error) {
            throw new Error(`Failed to change password: ${error.message}`);
        }
    }

    /**
     * Delete a user
     */
    async deleteUser(userId) {
        const isAccessible = await this.isContainerAccessible();
        if (!isAccessible) {
            throw new Error('SSH container is not accessible');
        }

        if (!await this.userExists(userId)) {
            throw new Error(`User '${userId}' does not exist`);
        }

        const username = `${userId}`;
        
        try {
            await this.execSSH(`deluser ${username}`);
            this.logger.info(`✅ User ${username} deleted`);
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }

    /**
     * Add SSH public key for a user
     */
    async addSSHKey(userId, publicKey) {
        if (!await this.userExists(userId)) {
            throw new Error(`User '${userId}' does not exist`);
        }



        // Write public key
        const keyContent = publicKey.trim() + '\n';
        

        // Set correct permissions via SSH
        const username = `${userId}`;
        const userHomeInContainer = `/users/apps/${userId}`;
        
        try {
            await this.execSSH(`
                touch ${userHomeInContainer}/.ssh/authorized_keys && \
                echo "${keyContent.replace(/"/g, '\\"')}" >> ${userHomeInContainer}/.ssh/authorized_keys && \
                chown ${username}:${username} ${userHomeInContainer}/.ssh/authorized_keys && \
                chmod 600 ${userHomeInContainer}/.ssh/authorized_keys
            `);
            this.logger.info(`✅ SSH key added for ${username}`);
        } catch (error) {
            throw new Error(`Failed to set key permissions: ${error.message}`);
        }
    }


    /**
     * Generate a secure random password
     */
    generatePassword(length = 16) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let password = '';
        const randomBytes = crypto.randomBytes(length);
        
        for (let i = 0; i < length; i++) {
            password += chars[randomBytes[i] % chars.length];
        }
        
        return password;
    }

     /**
     * Test SSH connection
     */
    async testConnection() {
        try {
            const { stdout } = await this.execSSH('hostname && whoami && uptime');
            return {
                success: true,
                output: stdout
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

}

export async function initSshApi({router, logger, graphql, appFileSystems}) {
    const sshManager = new SSHSandboxManager({logger});

    appFileSystems.addListener("fileWritten", async ({appName, relativePath, branch})=>{
        await sshManager.adjustFilePermissions(appName, path.join(branch,relativePath)) ;
    });

    /**
     * POST /api/ssh/users
     * Create SSH user and return connection info
     */
    router.post('/ssh/generateCredentials', async (req, res) => {
        try {
            if(!req.appName){ return res.status(400).json({ error: 'no application' }); }
            if(!await graphql.checkAppAccessMiddleware(req, res)){ 
                logger.warn('Access denied');
                return ;
            }

            const userId = req.appName ;

            const userInfo = await sshManager.createUser(userId);

            if(!userInfo.password){
                //already exists, change password
                const newPassword = sshManager.generatePassword();
                await sshManager.changeUserPassword(userId, newPassword);
                userInfo.password = newPassword ;
            }
            
            res.json({
                success: true,
                connection: {
                    username: userInfo.username,
                    port: userInfo.port,
                    password: userInfo.password
                }
            });
        } catch (err) {
            logger.warn('Generate credentials failed : %o', err);
            res.status(500).json({ error: err.message });
        }
    });


    /**
     * POST ssh/uploadKey
     * Add a public SSH key
     */
    router.post('/ssh/uploadKey', async (req, res) => {
        try {
            if(!req.appName){ return res.status(400).json({ error: 'no application' }); }
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}

            const userId = req.appName ;
            const { publicKey } = req.body;
            
            if (!publicKey) {
                return res.status(400).json({ error: 'missing publicKey' });
            }

            await sshManager.createUser(userId);

            await sshManager.addSSHKey(userId, publicKey);
            
            res.json({ 
                success: true, 
                message: 'SSH key added. You can now connect without a password.' 
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

