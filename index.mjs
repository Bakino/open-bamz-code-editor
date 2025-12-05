import express from "express";
import { initFileApi } from "./file-api.mjs";
import { initSshApi } from "./ssh.mjs";

/**
 * Called on each application startup (or when the plugin is enabled)
 * 
 * Use it to prepare the database and files needed by the plugin
 */
export const prepareDatabase = async () => {
    // nothing to prepare for this plugin
}

/**
 * Called when the plugin is disabled
 * 
 * Use it to eventually clean the database and files created by the plugin
 */
export const cleanDatabase = async () => {
    // nothing to clean for this plugin
}

/**
 * Init plugin when Open BamZ platform start
 */
export const initPlugin = async ({runQuery, logger, loadPluginData, contextOfApp, graphql, appFileSystems}) => {
    const router = express.Router();

    loadPluginData(async ({pluginsData})=>{
        if(pluginsData?.["code-editor"]?.pluginSlots?.codeEditors){
            pluginsData?.["code-editor"]?.pluginSlots?.codeEditors.push( {
                plugin: "code-editor",
                extensionPath: "/plugin/:appName/code-editor/js/code-editor-monaco.mjs"
            })
            pluginsData?.["code-editor"]?.pluginSlots?.codeEditors.push( {
                plugin: "code-editor",
                extensionPath: "/plugin/:appName/code-editor/js/code-editor-file.mjs"
            })
            pluginsData?.["code-editor"]?.pluginSlots?.codeEditors.push( {
                plugin: "code-editor",
                extensionPath: "/plugin/:appName/code-editor/js/code-editor-package/code-editor-package-json.mjs"
            })
        }
    }) ;

    initFileApi({router, contextOfApp, logger, runQuery, graphql}) ;
    initSshApi({router, logger, graphql, appFileSystems}) ;
    

    return {
        // path in which the plugin provide its front end files
        frontEndPath: "front",
        router: router,
        //menu entries
        menu: [
            {
                name: "admin", entries: [
                    { name: "SSH access", link: "/plugin/open-bamz-code-editor/ssh.html" }
                ]
            }
        ],
        pluginSlots: {
            codeEditors: [],
            javascriptApiDef: [],
            changesListeners: []
        }
    }
}