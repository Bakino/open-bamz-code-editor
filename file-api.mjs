import { readFile, writeFile, readdir, stat, unlink } from 'fs/promises'
import { mkdirs, remove } from 'fs-extra/esm';
import path from 'path';
import mime from 'mime';
import multer from 'multer';
import archiver from 'archiver';
import { promisify } from 'util';
import { exec } from 'child_process';
import { commitAllChanges, createBranchWithWorktree, getCommitCount, getCommitInfo, getFileContentDiff, getFileContentDiffWithHead, listCommitsAsJson} from './git.mjs' ;

const REGEXP_CHECK_PATH = /^[\p{L}\d\s\-_/.+]+$/u;

const IGNORED_FILES = [".git", ".DS_Store", ".gitignore", "node_modules"];

const DEFAULT_DIR = "public";
const BRANCHES_DIR = "branches";

const execAsync = promisify(exec);


async function runCommand(command, cwd){
    const { stderr, stdout } = await execAsync(command, {
        cwd
    });
    if(stderr){
        console.error(stderr);
        throw "Error while running command "+command+" in "+cwd;
    }
    return stdout;
}


export function initFileApi({router, contextOfApp, logger, graphql}){

    async function onFileChange({appName, filePath, relativePath, previousContent, newContent, changeType, basePath}){
        let appContext = await contextOfApp(appName) ;
        let changesListeners = appContext.pluginsData["code-editor"]?.pluginSlots?.changesListeners??[] ;
        for(let i=0; i<changesListeners.length; i++){
            let listener = changesListeners[i];
            listener({appName, filePath, changeType, basePath, relativePath, previousContent, newContent});
        }
    }


    function getSecurePath(dir, appName){
        // check the directory does not contain ".."
        if(dir.match(/\.\./)){
            throw new Error("Forbidden path");
        }
        let basePath = path.join(process.env.DATA_DIR, "apps", appName);
        if(dir === DEFAULT_DIR || !dir){
            return path.join(basePath, dir);
        }else{
            // The path is a branche, get path from branch directory
            return path.join(basePath, BRANCHES_DIR, dir);
        }
    }

    /**
     * Get the list of files in the directory of the app
     * 
     * @param {string} appName - Name of the app
     */
    router.get('/files/:appName', (req, res) => {
        
        (async () => {
            try{
                // Check user has proper authorization
                if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const getFiles = async (dir) => {
                    let results = [];
                    const list = await readdir(dir);
                    for (let file of list) {
                        if (IGNORED_FILES.includes(file)) {
                            continue;
                        }
                        file = path.resolve(dir, file);
                        const statFile = await stat(file);
                        if (statFile && statFile.isDirectory()) {
                            results.push({ name: path.basename(file), type: 'directory', children: (await getFiles(file)) });
                        } else {
                            results.push({ name: path.basename(file), type: 'file', mimeType: mime.getType(file), size: statFile?.size, lastModified: statFile?.mtimeMs });
                        }
                    }
                    return results;
                };
                res.json(await getFiles(filesDirectory));
            }catch(err){
                logger.warn(`Error list files ${req.params.appName} %o`, err)
                res.status(err.statusCode??500).json(err);
            }
        })();
    });


    router.get('/listBranches/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                const filesDirectory = path.join(process.env.DATA_DIR, "apps", req.params.appName, BRANCHES_DIR);
                try {
                    await stat(filesDirectory);
                // eslint-disable-next-line no-unused-vars
                } catch (error) {
                    await mkdirs(filesDirectory, { recursive: true });
                }
                const branches = await readdir(filesDirectory);
                res.json(branches.map(b=>({name: b})));
            }catch(err){
                logger.warn(`Error read branch ${req.params.appName} %o`, err)
                res.status(500).json(err);
            }
        })();
    });

    router.post('/createBranch/:appName/', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            const repoPath = path.join(process.env.DATA_DIR, "apps", req.params.appName, DEFAULT_DIR);
            const branchesPath = path.join(process.env.DATA_DIR, "apps", req.params.appName, BRANCHES_DIR);
            try{
                await createBranchWithWorktree(repoPath, req.body.branch, branchesPath, req.body.from);
                const branches = await readdir(branchesPath);
                res.json({success: true, branches: branches.map(b=>({name: b}))});
            }catch(err){
                logger.warn(`Error create branch ${req.query.branch} %o`, err)

                res.status(500).json(err);
            }
        })();
    });

    // Get File Content
    router.get('/files/:appName/content', (req, res) => {
        (async () => {
            if (!req.query.path) {
                return res.status(400).end("Missing path")
            }
            if (!req.query.path.match(REGEXP_CHECK_PATH)) {
                return res.status(500).end("Forbidden path " + req.query.path)
            }

            try {
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const filePath = path.join(filesDirectory, req.query.path);
                if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
                const mimeType = mime.getType(filePath);
                res.setHeader('Content-Type', mimeType);
                res.send(await readFile(filePath));
            } catch (err) {
                logger.warn(`Error reading file ${req.query.path} %o`, err)
                res.status(500).send('Error reading file ' + req.query.path);
            }
        })();
    });

    // Save File Content
    // Configure multer to use memory storage
    const storage = multer.memoryStorage();
    const upload = multer({ storage: storage });
    router.post('/files/:appName/save', upload.single('file'), (req, res) => {
        if (!req.body.path) {
            return res.status(400).end("Missing path")
        }
        if (!req.body.path.match(REGEXP_CHECK_PATH)) {
            return res.status(500).end("Forbidden path " + req.body.path)
        }
        (async () => {
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}

            
            try {
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const filePath = path.join(filesDirectory, req.body.path);
                // Ensure the target directory exists
                await mkdirs(path.dirname(filePath), { recursive: true });

                let previousContent;
                
                try{
                    previousContent = await readFile(filePath) ;
                // eslint-disable-next-line no-unused-vars
                }catch(err){
                    //file not exists
                }

                // Write the file from memory buffer to the final destination
                await writeFile(filePath, req.file.buffer);

                console.log("SAVED FILE "+filePath+" / "+Date.now());

                const statFile = await stat(filePath);

                await commitAllChanges(filesDirectory, { commitMessage: req.body.commitMessage||`Save file ${path.relative(filesDirectory, filePath)}` });

                await onFileChange({appName: req.params.appName, filePath, 
                        relativePath: req.body.path, 
                        previousContent, newContent: req.file.buffer, 
                        changeType: "save", basePath: filesDirectory});

                res.json({ success: true, size: statFile?.size, lastModified: statFile?.mtimeMs });
            } catch (err) {
                console.warn(`Error writing file ${req.body.path} %o`, err);
                res.status(500).send('Error writing file ' + req.body.path);
            }
        })();

    });

    router.post('/files/:appName/createDir', (req, res) => {
        if (!req.body.path) {
            return res.status(400).end("Missing path")
        }
        if (!req.body.path.match(REGEXP_CHECK_PATH)) {
            return res.status(500).end("Forbidden path " + req.body.path)
        }
        (async () => {
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}

            
            try {
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const filePath = path.join(filesDirectory, req.body.path);
                // Ensure the target directory exists
                await mkdirs(filePath, { recursive: true });

                const statFile = await stat(filePath);

                res.json({ success: true, size: statFile?.size, lastModified: statFile?.mtimeMs });
            } catch (err) {
                console.warn(`Error create dir ${req.body.path} %o`, err);
                res.status(500).send('Error create dir ' + req.body.path);
            }
        })();

    });

    // Delete file
    router.get('/files/:appName/delete', (req, res) => {
        (async () => {
            if (!req.query.path) {
                return res.status(400).end("Missing path")
            }
            if (!req.query.path.match(REGEXP_CHECK_PATH)) {
                return res.status(500).end("Forbidden path " + req.body.path)
            }
            try {
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const filePath = path.join(filesDirectory, req.query.path);
                const previousContent = await readFile(filePath) ;

                if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
                await unlink(filePath) ;

                await commitAllChanges(filesDirectory, { commitMessage: `Delete file ${path.relative(filesDirectory, filePath)}` });

                await onFileChange({appName: req.params.appName, filePath, 
                    relativePath: req.body.path, 
                    previousContent, newContent: null, 
                    changeType: "delete",  basePath: filesDirectory});

                res.json({success: true})
            } catch (err) {
                logger.warn(`Error delete file ${req.query.path} %o`, err)
                res.status(500).send('Error reading file ' + req.query.path);
            }
        })();
    });

    router.get('/files/:appName/deleteDir', (req, res) => {
        (async () => {
            if (!req.query.path) {
                return res.status(400).end("Missing path")
            }
            if (!req.query.path.match(REGEXP_CHECK_PATH)) {
                return res.status(500).end("Forbidden path " + req.body.path)
            }
            try {
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const filePath = path.join(filesDirectory, req.query.path);
                if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
                await remove(filePath) ;
                await commitAllChanges(filesDirectory, { commitMessage: `Delete directory ${path.relative(filesDirectory, filePath)}` });
                
                await onFileChange({appName: req.params.appName, filePath, changeType: "deleteDir", basePath: filesDirectory});

                res.json({success: true})
            } catch (err) {
                logger.warn(`Error delete file ${req.query.path} %o`, err)
                res.status(500).send('Error reading file ' + req.query.path);
            }
        })();
    });
    

    router.get('/zip/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}

            const zipFileName = `${req.params.appName}.zip`;
            res.setHeader('Content-Disposition', `attachment; filename=${zipFileName}`);
            res.setHeader('Content-Type', 'application/zip');
          
            // Create the zip archive
            const archive = archiver('zip', {
                zlib: { level: 5 } // Sets the compression level (0-9)
            });
          
            // On archive finalize, log result
            // archive.on('end', () => {
            //   console.log(`Archive ${zipFileName} has been finalized and output file descriptor has closed.`);
            // });
          
            // Handle archive errors
            archive.on('error', (err) => {
                throw res.status(500).json(err);
            });
          
            // Pipe the output to the response
            archive.pipe(res);
          
            // Append files from the directory
            const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
            archive.directory(filesDirectory, false);
          
            // Finalize the archive
            archive.finalize();
        })();
    });

    router.get('/editor-extensions/:appName', (req, res) => {
        (async ()=>{
            
            let appContext = await contextOfApp(req.params.appName) ;
            let allowedExtensions = appContext.pluginsData["code-editor"]?.pluginSlots?.codeEditors??[] ;
            let js = `let extensions = [];`;
            for(let i=0; i<allowedExtensions.length; i++){
                let ext = allowedExtensions[i];
                js += `
                import ext${i} from "${ext.extensionPath.replace(":appName", "app")}" ;
                extensions.push({ plugin: "${ext.plugin}", ...ext${i}}) ;
                `
            }
            js += `export default extensions`;
            res.setHeader("Content-Type", "application/javascript");
            res.end(js);
        })();
    });
    router.get('/editor-javascript-api/:appName', (req, res) => {
        (async ()=>{
            
            let appContext = await contextOfApp(req.params.appName) ;
            let allowedExtensions = appContext.pluginsData["code-editor"]?.pluginSlots?.javascriptApiDef??[] ;
            let js = `let apis = [];`;
            for(let i=0; i<allowedExtensions.length; i++){
                let ext = allowedExtensions[i];
                js += `apis.push({ plugin: "${ext.plugin}", url: "${ext.url.replaceAll(":appName", req.params.appName)}"}) ;`
            }
            js += `export default apis`;
            res.setHeader("Content-Type", "application/javascript");
            res.end(js);
        })();
    });


    /**
     * Get the history entry count of the app
     * 
     * @param {string} appName - Name of the app
     */
    router.get('/git/history/count/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const count = await getCommitCount(filesDirectory);
                res.json({count});
            }catch(err){
                if(err.message){
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.get('/git/history/list/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const commits = await listCommitsAsJson(filesDirectory, { offset: req.query.offset, limit: req.query.limit });
                res.json(commits);
            }catch(err){
                if(err.message){
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.get('/git/history/commitInfo/:appName/:hash', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const infos = await getCommitInfo(filesDirectory, req.params.hash);
                res.json(infos);
            }catch(err){
                if(err.message){
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.get('/git/history/commitContentDiff/:appName/:hash/:filePath', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const result = await getFileContentDiff(filesDirectory, req.params.hash, req.params.filePath);
                res.json(result);
            }catch(err){
                if(err.message){
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.get('/git/history/commitContentDiffHead/:appName/:hash/:filePath', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const result = await getFileContentDiffWithHead(filesDirectory, req.params.hash, req.params.filePath);
                res.json(result);
            }catch(err){
                if(err.message){
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.post('/addPackage/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                if (!req.body.filePackage.match(REGEXP_CHECK_PATH)) {
                    return res.status(500).end("Forbidden path " + req.body.filePackage)
                }

                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const packagePath = path.join(filesDirectory, req.body.filePackage);

                const stdout = await runCommand('npm install --ignore-scripts '+req.body.packageName, path.dirname(packagePath));

                const packageJson = await readFile(packagePath, {encoding: "utf-8"}) ;

                res.json({
                    stdout, packageJson: packageJson
                });
            }catch(err){
                if(err.message){
                    logger.warn("Error while run npm install "+req.body.packageName+" %o ", err) ;
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.post('/npmInstall/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                if (!req.body.filePackage.match(REGEXP_CHECK_PATH)) {
                    return res.status(500).end("Forbidden path " + req.body.filePackage)
                }

                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const packagePath = path.join(filesDirectory, req.body.filePackage);

                const stdout = await runCommand('npm install --ignore-scripts', path.dirname(packagePath));

                const packageJson = await readFile(packagePath, {encoding: "utf-8"}) ;

                res.json({
                    stdout, packageJson: packageJson
                });
            }catch(err){
                if(err.message){
                    logger.warn("Error while run npm install "+req.body.packageName+" %o ", err) ;
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });

    router.post('/removePackage/:appName', (req, res) => {
        (async ()=>{
            if(!await graphql.checkAppAccessMiddleware(req, res)){ return ;}
            try{
                if (!req.body.filePackage.match(REGEXP_CHECK_PATH)) {
                    return res.status(500).end("Forbidden path " + req.body.filePackage)
                }

                const filesDirectory = getSecurePath(req.query.dir??DEFAULT_DIR, req.params.appName);
                const packagePath = path.join(filesDirectory, req.body.filePackage);

                const stdout = await runCommand('npm uninstall --ignore-scripts '+req.body.packageName, path.dirname(packagePath));

                const packageJson = await readFile(packagePath, {encoding: "utf-8"}) ;

                res.json({
                    stdout, packageJson: packageJson
                });
            }catch(err){
                if(err.message){
                    logger.warn("Error while run npm install "+req.body.packageName+" %o ", err) ;
                    return res.status(500).json(err.message);
                }
                res.status(500).json(err);
            }
        })();
    });
}

