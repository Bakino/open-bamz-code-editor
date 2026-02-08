
/// <reference lib="dom" />

/**
 * Represents a Router for managing application routes.
 */
declare class ViewZRouter {

    /**
     * Open mode stack on right : (
     */
    STACK_RIGHT: string;
    /**
     * Open mode stack on left : )
     */
    STACK_LEFT: string;
    /**
     * Open mode stack on bottom : _
     */
    STACK_BOTTOM: string;
    /**
     * Open mode stack on top : -
     */
    STACK_TOP: string;
    /**
     * Open mode stack as dialog : ()
     */
    STACK_DIALOG: string;
    /**
     * Open mode stack on fullscreen : ""
     */
    STACK_FULLSCREEN: string;
    /**
     * Open mode stack on side left : -I
     */
    STACK_SIDE_LEFT: string;
    /**
     * Open mode stack on side right : I-
     */
    STACK_SIDE_RIGHT: string;
    /**
     * Open mode stack on side top : T
     */
    STACK_SIDE_TOP: string;
    /**
     * Open mode stack on side bottom : L
     */
    STACK_SIDE_BOTTOM: string;
    
   
    /**
     * Navigates to the target location.
     * @param path - Path to navigate to, either a string or an object with pathname, search, and hash.
     * @param force - Whether to force navigation even if the path is the same as the previous one.
     * @returns A promise that resolves when navigation is complete.
     */
    navigateTo(path: string | { pathname: string; search?: string; hash?: string }, force?: boolean): Promise<void>;
  
    /**
     * Open a route without navigate the URL. Use the stack syntax to open in side or popup
     * 
     * Optionally give openParams (received in view.route.params)
     * 
     * It returns a promise that resolve when the opened view calls close(myresult) an. 
     * myresult is given back
     * 
     * Example to open in left side: 
     *    let result = await view.router.openRoute({route: "/*)*&#8203;/my/popup", openParams: {data}})
     * 
     * possible open options : 
     *  ( : stack on right
     *  ) : stack on right
     *  _ : stack bottom
     *  - : stack top
     *  () : dialog
     *  (empty): full screen
     *  -I : side on left (split screen)
     *  I- : side on right (split screen)
     *  T : side on top (split screen)
     *  L : side on bottom (split screen)
     *
     * @returns A promise that resolves when opened route is closed
     */
    openRoute(params: {route: string; openParam?: object, openMode?: string, openModeOptions?: string}): Promise<any>;

    /**
     * Automatically navigates to a path in the router or open link if the path is not a route of the application
     * @param path - Path to navigate to.
     * @param target - Target window or tab for navigation.
     */
    autoNavigate(path: string, target?: string): void;
  
    /**
     * Replaces the current location. The difference with navigateTo is that the history item is replaced
     * @param path - Path to replace with, either a string or an object with pathname, search, and hash.
     * @returns A promise that resolves when the replacement is complete.
     */
    replace(path: string | { pathname: string; search?: string; hash?: string }): Promise<void>;
  
    /**
     * Returns the current location.
     * @returns The current location as a string.
     */
    getCurrentLocation(): string;


    /**
     * Close the last route item in the stack
     * 
     * If you are using a view stack, use this function to close the stack and return to lower item in the stack
     * 
     * @returns A promise that resolves when navigation is complete.
     */
    closeStack(): void;
  
}


/**
 * Waiter options
 */
declare interface WaiterOptions {
    /** The parent element into display the spinner (default: body) */
    parentElement?: HTMLElement;
    /** A message to display under the spinner */
    message?: string;
}


/**
 * Display a spinner while waiting for a promise to resolve
 * 
 * @param promise The promise to wait for. It can also be an async function
 */
declare function waiter(promise: Promise<any>|Function, options?: WaiterOptions): Promise<any>;

/**
 * Import a lib in global headers
 * 
 * @param url URL of lib to import
 */
declare function loadScript(url: string): Promise<void>;

/**
 * By default, all view function that does async job starts a waiting spinner
 * 
 * Sometime you may need to have an async view function that does not starts the waiting spinner
 * 
 * You can use this helper function
 * 
 * ```javascript
 * view.saveData = async ()=>{
 *     // running this function will display a waiting spinner until it is finished
 * }
 * 
 * view.iDontWantSpinner = noWaiter(async()=>{
 *     // running this function will not display spinner
 * 
 *     // you can still use the waiter helper function if you need to display manually a spinner
 * })
 * ```
 * 
 * @param f the async function
 */
declare function noWaiter(f: Function): Function;


/**
 * Route information
 */
declare interface ViewRoute {
    /**
     * The parameters received from the route URL
     * 
     * example, the URL /user/:id will have the following parameters: {id: ""}
     */
    params: any;

    /**
     * Change the route parameters
     * 
     * @param params The parameters to set ({param1: "value1", param2: "value2"})
     */
    setParams(params: object): void;
}

declare interface ViewExtension {
    /**
     * Globals variables to inject into all ViewZ
     */
    globals: object;

    /**
     * The config of the extension (if any)
     */
    config?: object;
}

declare interface ViewOptions {
    /** Can be either path to the HTML file or directly the HTML source */
    html: string,
    /** Can be either path to the JS file or directly the JS source */
    js: string,
    /** Can be either path to the CSS file or directly the CSS source */
    css: string,
    /** ID of the view */
    id: string,
    /** Provide your own spinner source code. The spinner is display during the loading of the view */
    spinner?: string,
}

/**
 * ViewZ class
 */
declare class ViewZ {
    /** You can add you methods, usually event handling functions */
    [key: string]: any;


    /** loaded extension */
    static extensions: any[];
    /**
     * Load an extension in ViewZ system
     * 
     * @example
     * ```javascript
     * ViewZ.loadExtension({ globals: { tr: (key) => i18n.t(key) } });
     * ```
     * @param extension the extension to load
     */
    static loadExtension(extension: ViewExtension): void;

    /**
     * Get a loaded extension.
     * 
     * Can be useful to set some config to the extension
     * 
     * Example : 
     * ```javascript
     * ViewZ.getExtension("bootstrap5").config.cancelConfirm = "Are you really sure to cancel ??" ;
     * ```
     * 
     * @param pluginName the name of the plugin that load the extension
     */
    static getExtension(pluginName: string): ViewExtension;

    /** The container in which the view is rendered */
    container: HTMLElement;
    /** The route information */
    route: ViewRoute;
    /** The data rendered by the view */
    data: any;

    constructor(options: ViewOptions);

    /** If implemented, is called when the view is displayed */
    displayed(): Promise<void>;
    /** 
     * Implement to prepare the data to render on view loading or refresh 
     * The result will be the initial value of the data property 
     */
    loader(): Promise<object>;

    /** 
     * Set the waiter message to display on the displayed spinner 
     * 
     * All your view async function automatically display a spinner. 
     * Use this function to show a message under the spinner
     * 
     * @example
     * ```javascript
     * view.processValidation = async ()=>{
     *    view.waiterMessage = "Please wait while we validate the input" ;
     *    //do your stuff
     * 
     *    // you can change the message at any time
     *    view.waiterMessage = "Stay here the process is still running !" ;
     * } ;
     */
    set waiterMessage(msg: string);

    /** 
     * Get the clean data of the view 
     * 
     * The clean data is the data without the internal properties of the view
     * 
     * @example
     * ```javascript
     * view.loader = async ()=>{
     *    return { name: "John", age: 18 } ;
     * };
     * 
     * view.someFunction = async ()=>{
     *    // some internal properties are added to the data to manage the render, to get a pure object without the internal properties use getCleanData
     *    console.log(view.getCleanData()) ; // { name: "John", age: 18 }
     * }
     */
    getCleanData(): any;   
    
    
    /**
     * add a listener to data change
     * 
     * The path must be a path of the change data like "person.name"
     * The listener will be call on any change the impact the path. 
     * In this example, if name is change or the whole person is changed
     * 
     * The function receive a object with : 
     * {oldValue, newValue, target}
     * 
     * The path can take * as joker (ex: person.*)
     */
    addDataListener(path:string, listener: Function): void;

    /**
     * Refresh the view (run again the loader function and render with the new data)
     */
    refresh(): Promise<void>;

    /**
     * Add an event listener to the view container itself.
     * Don't use view.container.addEventListener directly, use this function instead 
     * because the view.container may be still here even if the view is not displayed anymore
     */
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    /**
     * Dispatch an event on the view
     * 
     * @example
     * ```javascript
     * // will dispatch an event named "myEvent" with the data { data: "some data" } in ev.detail
     * view.dispatchEvent("myEvent", { data: "some data" }) ;
     * 
     * // you can also use the standard CustomEvent constructor
     * view.dispatchEvent(new CustomEvent("myEvent", { detail: { data: "some data" } })) ;
     * 
     * @param event 
     * @param data 
     */
    dispatchEvent(event: string | Event, data?: any): void;

    /**
     * Get an element by its id within the view
     * @param id id of the element
     */
    getElementById(id: string): HTMLElement | null;

    /**
     * Get element by is CSS selector within the view
     * @param selector CSS selector
     */
    querySelector(selector: string): Element | null;

    /**
     * Get elements by is CSS selector within the view
     * @param selector  CSS selector
     */
    querySelectorAll(selector: string): Element[];

    /**
     * Router of the application
     */
    router: ViewZRouter;
}

declare const view: ViewZ;
