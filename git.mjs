import fs from "fs-extra" ;
import path from "path" ;
import simpleGit from "simple-git" ;

/**
 * Initialize a git repository in the specified directory if it doesn't exist
 * @param {string} directoryPath - Path to the directory
 * @returns {Promise<SimpleGit>} - The git instance
 */
export async function initGitIfNotExists(directoryPath) {
    try {
        // Create directory if it doesn't exist
        try {
            await fs.stat(directoryPath);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            await fs.mkdir(directoryPath, { recursive: true });
        }

        const git = simpleGit(directoryPath);
        
        // Check if git repo already exists
        const isRepo = await git.checkIsRepo();
        
        if (!isRepo) {
            await git.init();
            console.log('Initialized new Git repository');
        } else {
            console.log('Git repository already exists');
        }
        
        return git;
    } catch (error) {
        console.error('Error initializing git repository:', error);
        throw error;
    }
}

/**
 * Commit all modified and new files in the repository
 * @param {string} repoPath - Path to the git repository
 * @param {Object} options - Options for the commit
 * @param {string} options.commitMessage - Commit message
 * @param {string} options.authorName - Author name
 * @param {string} options.authorEmail - Author email
 * @returns {Promise<void>}
 */
export async function commitAllChanges(repoPath, {commitMessage = 'Auto commit'} = {}) {
    try {
        await initGitIfNotExists(repoPath);

        const git = simpleGit(repoPath);
        
        // Add all files
        await git.add('.');
        
        // Check if there are changes to commit
        const status = await git.status();
        
        if (status.files.length > 0) {
            // Perform the commit
            const commitResult = await git.commit(commitMessage)//, ["-c", "user.name=" + authorName, "-c", "user.email=" + authorEmail]);
            console.log('Changes committed successfully:', commitResult);
        } else {
            console.log('No changes to commit');
        }
    } catch (error) {
        console.error('Error committing changes:', error);
        throw error;
    }
}

/**
 * List git commits as JSON with pagination options
 * @param {string} repoPath - Path to the git repository
 * @param {Object} [options] - Pagination options
 * @param {number} [options.offset=0] - Number of commits to skip
 * @param {number} [options.limit=10] - Maximum number of commits to return
 * @returns {Promise<Array>} - Array of commit objects
 */
export async function listCommitsAsJson(repoPath, options = {}) {
    try {
        await initGitIfNotExists(repoPath);

        const git = simpleGit(repoPath);
        
        // Set default values for options
        const { offset = 0, limit = 10 } = options;
        
        // Get log with specific format and pagination
        let gitOptions = {
            format: {
                hash: '%H',
                date: '%ai',
                message: '%s',
                author_name: '%an',
                author_email: '%ae'
            },
            n: limit
        };
        if(offset && Number(offset)){
            gitOptions["--skip"] = Number(offset);
        }
        const logs = await git.log(gitOptions);

        return logs.all;
    } catch (error) {
        console.error('Error listing commits:', error);
        throw error;
    }
}

/**
 * Get the total number of commits in the repository
 * @param {string} repoPath - Path to the git repository
 * @returns {Promise<number>} - Total number of commits
 */
export async function getCommitCount(repoPath) {
    try {
        await initGitIfNotExists(repoPath);
        const git = simpleGit(repoPath);
        
        // Get log count using rev-list
        const count = await git.raw(['rev-list', '--count', 'HEAD']);
        
        // Parse the string result to number
        return parseInt(count.trim(), 10);
    } catch (error) {
        console.error('Error counting commits:', error);
        throw error;
    }
}

/**
 * Get the list of modified files for a specific commit
 * @param {string} repoPath - Path to the git repository
 * @param {string} commitHash - Hash of the commit to analyze
 * @returns {Promise<Array>} - Array of objects containing file paths and their modification types
 */
export async function getCommitInfo(repoPath, commitHash) {
    try {
        const git = simpleGit(repoPath);
        
        // Get the diff of the commit compared to its parent
        const diff = await git.raw([
            'diff-tree',
            '--no-commit-id',
            '--name-status',
            '-r',
            commitHash
        ]);

        // Parse the diff output
        const files = diff.trim().split('\n').map(line => {
            const [status, ...filePath] = line.split('\t');
            
            // Map git status to more readable descriptions
            const statusMap = {
                'A': 'added',
                'M': 'modified',
                'D': 'deleted',
                'R': 'renamed',
                'C': 'copied'
            };

            return {
                path: filePath.join('\t'), // Rejoin path in case it contained tabs
                type: statusMap[status[0]] || 'unknown'
            };
        });

        return {files};
    } catch (error) {
        console.error('Error getting commit files:', error);
        throw error;
    }
}

/**
 * Get the content of a file before and after a specific commit
 * @param {string} repoPath - Path to the git repository
 * @param {string} commitHash - Hash of the commit to analyze
 * @param {string} filePath - Path of the file to analyze
 * @returns {Promise<Object>} - Object containing the file content before and after the commit
 */
export async function getFileContentDiff(repoPath, commitHash, filePath) {
    try {
        const git = simpleGit(repoPath);
        
        // Get the parent commit hash
        const parentHash = await git.raw(['rev-parse', `${commitHash}^`]);
        
        let beforeContent = '';
        let afterContent = '';

        try {
            // Get content before commit (from parent)
            beforeContent = await git.show([`${parentHash.trim()}:${filePath}`]);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            // File might not exist before the commit
            beforeContent = '';
        }

        try {
            // Get content after commit
            afterContent = await git.show([`${commitHash}:${filePath}`]);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            // File might have been deleted in the commit
            afterContent = '';
        }

        return {
            before: beforeContent,
            after: afterContent,
            wasDeleted: afterContent === '',
            wasCreated: beforeContent === ''
        };
    } catch (error) {
        console.error('Error getting file content diff:', error);
        throw error;
    }
}

/**
 * Get the content of a file before a specific commit and at HEAD
 * @param {string} repoPath - Path to the git repository
 * @param {string} commitHash - Hash of the commit to analyze
 * @param {string} filePath - Path of the file to analyze
 * @returns {Promise<Object>} - Object containing the file content before the commit and at HEAD
 */
export async function getFileContentDiffWithHead(repoPath, commitHash, filePath) {
    try {
        const git = simpleGit(repoPath);
        
        let beforeContent = '';
        let afterContent = '';

        try {
            // Get content before the commit
            beforeContent = await git.show([`${commitHash}:${filePath}`]);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            // File might not exist before the commit
            beforeContent = '';
        }

        try {
            // Get content at HEAD
            afterContent = await git.show([`HEAD:${filePath}`]);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            // File might not exist at HEAD
            afterContent = '';
        }

        return {
            before: beforeContent,
            after: afterContent,
            wasDeleted: afterContent === '',
            wasCreated: beforeContent === ''
        };
    } catch (error) {
        console.error('Error getting file content diff:', error);
        throw error;
    }
}

/**
 * Creates a new branch with a worktree in the branches directory
 * @param {string} repoPath - Path to the main git repository (e.g., '/public')
 * @param {string} newBranchName - Name of the new branch to create
 * @param {string} branchesPath - Path to the branches directory (e.g., '/branches')
 * @param {string} sourceBranch - Source branch to create from (e.g., 'main' or 'feature-one')
 * @returns {Promise<void>}
 * @throws {Error} If branch creation fails or paths are invalid
 */
export async function createBranchWithWorktree(repoPath, newBranchName, branchesPath, sourceBranch) {
    try {
        await initGitIfNotExists(repoPath);
        // Initialize git in the main repository
        const git = simpleGit(repoPath);

        //check branch name is valid
        if (!newBranchName.match(/^[a-zA-Z0-9-]+$/)) {
            throw new Error('Invalid branch name');
        }

        // Calculate the target path for the new branch
        const targetPath = path.join(branchesPath, newBranchName);

        // Check if target directory already exists
        try {
            await fs.stat(targetPath);
            throw new Error(`Directory already exists: ${targetPath}`);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            //ok does not exist
        }

        // Get the relative path from public to branches directory
        const relativeTargetPath = path.relative(repoPath, targetPath);

        // Create new worktree with branch
        let args = [
            'worktree',
            'add',
            '-b',
            newBranchName,
            relativeTargetPath        ];
        if(sourceBranch && sourceBranch !== 'public'){
            args.push(sourceBranch);
        }
        await git.raw(args);

        console.log(`Successfully created branch '${newBranchName}' from '${sourceBranch}'`);
        console.log(`Worktree location: ${targetPath}`);

    } catch (error) {
        throw new Error(`Failed to create branch: ${error.message}`);
    }
}
