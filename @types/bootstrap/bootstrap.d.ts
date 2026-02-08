
/**
 * Options to create a modal dialog
 */
declare interface ModalBaseOptions {
    /**
     * Title of the modal
     */
    title?: string;
    /**
     * HTML content of the modal body
     */
    bodyContents?: string;
    /**
     * HTML content of the modal footer. No footer will be added if not given
     */
    footerContents?: string;

    /**
     * CSS class to add to header (ex: `text-bg-danger`)
     */
    headerClass?: string;
    /**
     * Size of the modal 
     *  sm: Small
     *  lg: Large
     *  xl: Extra large
     */
    size?: 'sm' | 'lg' | 'xl';

    /**
     * If true, the modal will be draggable (default: true)
     */
    draggable?: boolean;

    /**
     * If true, the modal will be closeable (default: true)
     */
    closeable?: boolean;

    /**
     * If true, the modal will be displayed above all other elements (default: false)
     */
    aboveAll?: boolean;
}

/**
 * Options to open a model
 */
declare interface ModalOptions extends ModalBaseOptions {
    /**
     * Includes a modal-backdrop element. Alternatively, specify static for a backdrop which doesn’t close the modal when clicked.  (default: true)
     */
    backdrop?: boolean|'static';

    /**
     * Puts the focus on the modal when initialized (default: true)
     */
    focus?: boolean;

    /**
     * Closes the modal when escape key is pressed  (default: true)
     */
    keyboard?: boolean;
}

/**
 * Option to open a view in a modal
 */
declare interface ModalOptionsViewZ extends ModalOptions {
    /**
     * The view to open
     */
    view: object;

    /**
     * Open params to give to the view
     */
    openParams?: object;
}

/**
 * Option to open a view in a modal
 */
declare interface ModalOptionsRouteZ extends ModalOptions {
    /**
     * The route to open
     */
    route: string;

    /**
     * Open params to give to the view
     */
    openParams?: object;
}

/**
 * Options to create a modal dialog with a message
 */
declare interface ModalMessageOptions extends ModalOptions {
    /**
     * The message to display
     */
    message?: string;

    /**
     * the label to use for OK button (default: `OK`)
     */
    labelOk?: string;
}

/**
 * Configuration of a choice to answer the question
 */
declare interface QuestionChoice {
    /**
     * Label of the choice
     */
    label: string;
    /**
     * Code of the choice (returned when the choice is selected)
     */
    code: string | boolean;

    /**
     * CSS class to add to the choice button (ex: `btn-danger`)
     */
    className: string;

    /**
     * If true, the button of this choice will get the focus on open
     */
    focus?: boolean;

    /**
     * If true, this choice will be returned if the modal is closed without click on a choice
     */
    isDefault?: boolean;
}

/**
 * Options to create a modal dialog that asks a question
 */
declare interface QuestionOptions extends ModalOptions {
    /**
     * The message (question) to display
     */
    message: string;

    /**
     * List of choices to answer the question
     */
    choices: QuestionChoice[];
}

/**
 * Options to create a modal dialog that asks for confirmation
 */
declare interface ConfirmOptions extends ModalOptions {
    /**
     * The message to display
     */
    message: string;

    /**
     * Label of the yes button (default: `Yes`)
     */
    yesLabel?: string;

    /**
     * Label of the no button (default: `No`)
     */
    noLabel?: string;

    /**
     * If true, the focus is given to the no button, otherwise the focus is given to the yes button
     */
    focusToNoButton?: boolean;
}

declare interface ModalResult {
    /**
     * The bootstrap modal object
     */
    modal: object; 

    /**
     * The bootstrap modal HTML element
     */
    element: HTMLElement 
}

/**
 * Bootstrap dialogs utility
 */
declare interface Bootstrap5Dialogs {
    /**
     * Prepare a modal element
     * 
     * This function is used by other dialogs functions. 
     * 
     * You can use it create you own custom modal dialog
     * 
     * @param options the modal options
     */
    prepareModal(options: ModalBaseOptions): HTMLElement;

    /**
     * Display a modal dialog with a message
     * @param options 
     * @returns a promise that is resolved when the modal is closed
     */
    modalMessage(options: ModalOptions): Promise<void>;

    /**
     * Display a modal dialog
     * 
     * This function is used by other dialogs functions. 
     * 
     * You can use it create you own custom modal dialog
     * 
     * @param options the modal options
     */
    modal(options: ModalOptions): ModalResult;

    /**
     * Display an info message dialog
     * 
     * @param params 
     * @returns a promise that is resolved when the modal is closed
     */
    info(params: string | ModalMessageOptions): Promise<void>;

    /**
     * Display an error message dialog
     * 
     * @param params 
     * @returns a promise that is resolved when the modal is closed
     */
    error(params: string | ModalMessageOptions): Promise<void>;

    /**
     * Display a modal that asks a question an can have multiple choices
     * 
     * @example
     * ```javascript
     * const answer = await dialogs.question({ 
     *      title: "What do you want ?",
     *      message: "You are near a cliff and an enemy is behind you. What do you want to do ?",
     *      choices: [
     *        {label : "Jump", code: "jump", className: "btn-warning", focus: true, isDefault: true},
     *        {label : "Fight !", code: "fight", className: "btn-primary"}
     *      ], 
     *  });
     * if (answer === "jump") { dialogs.error("You jumped and died !"); }
     * if (answer === "fight") { dialogs.error("You died fighting !"); }
     * ```
     * 
     * @param options 
     * @returns a promise that is resolved when the modal is closed with the value of chosen choice
     */
    question(options: QuestionOptions): Promise<string | boolean | undefined>;

    /**
     * Display a confirmation dialog
     * 
     * If the user close without choosing yes or no, it is considered as a no
     * 
     * If the user yes, the promise is resolved with true, otherwise it is resolved with false
     * 
     * @example
     * ```javascript
     * const yesIWantToFight = await dialogs.confirm("Do you want to fight the giant");
     * if (yesIWantToFight) { 
     *      dialogs.error("You died fighting !"); 
     * } else {
     *      dialogs.error("You ran but died anyway, the giant is faster you dump !"); 
     * }
     * ```
     * 
     * @param params 
     */
    confirm(params: string | ConfirmOptions): Promise<boolean>;
}

declare interface Bootstrap5DialogsViewZ extends Bootstrap5Dialogs {
        /**
     * Open a view in a modal
     * 
     * @example
     * ```javascript
     * 
     * const view = new ViewZ({
     *         html: `...html`,
     *         css: `...css`,
     *         js: `...js`,
     *         id: "..."
     * });
     * // in view code, call view.closePopup(resultData) to close the modal and give result
     * 
     * const result = await dialogs.viewModal({view}) ;
     * ```
     * 
     * @param options the modal options
     * @returns a promise that is resolved when the modal is closed with the value given by the view in closePopup
     */
        viewModal(options: ModalOptionsViewZ): any;

    /**
     * Open a route in a modal
     * 
     * @example
     * ```javascript
     * 
     * // in view code, call view.closePopup(resultData) to close the modal and give result
     * 
     * const result = await dialogs.viewRoute({route: "/my/view/route/param"}) ;
     * 
     * // you can give params to the view, will be accessible in view.route.params of the view of modal
     * const result = await dialogs.viewRoute({route: "/my/view/route/param", openParams: { some: data }}) ;
     * ```
     * 
     * @param options the modal options
     * @returns a promise that is resolved when the modal is closed with the value given by the view in closePopup
     */
    routeModal(options: ModalOptionsRouteZ): any;
}

declare interface Bootstrap5HTMLFormElement extends HTMLFormElement {
    /**
     * Perform validation of the fields of the form
     * 
     * If the form contains an element `.form-feedback`the validation message will be displayed in this element.
     * 
     * The validations messaged are also displayed under each form element
     * 
     * @param form the form element to validate
     * @returns true if the form is valid, false otherwise
     */
    validate(): boolean;

    /**
     * Apply the mode to the form
     *   if read mode all field are readonly
     *   if edit or create mode all field are editable
     * 
     * If some fields are readonly on form init, they will be kept as readonly
     * 
     * @param {string} mode mode of the form can be "read", "edit", "create"
     */
    applyMode(mode: string): void;
}

declare interface Bootstrap5 {

    /**
     * The bootstrap 5 library object
     */
    bootstrap: any;


    /**
     * Perform validation of the fields of the form
     * 
     * If the form contains an element `.form-feedback`the validation message will be displayed in this element.
     * 
     * The validations messaged are also displayed under each form element
     * 
     * @param form the form element to validate
     * @returns true if the form is valid, false otherwise
     */
    validateForm(form: HTMLFormElement): boolean;

    /**
     * Create an enhanced form element that handle validation and edition mode
     * 
     * @param form the form element control
     */
    initForm(form: HTMLFormElement): Bootstrap5HTMLFormElement;

    /**
     * Dialogs utility
     */
    dialogs: Bootstrap5Dialogs;
}

interface ViewZ {
    /**
     * Manage a form in the view
     * 
     * This function will automate the form in the view.
     * 
     * It expect a few things in the view : 
     *   - the route should have an optional `:id?` parameter that contains the primary key of the record
     *   - the view data should contains a `mode` property that contains the mode of the form (read, edit, create).
     *   - the view loader should set the `mode` property to create if the route id is not set and to read if the route id is set
     * 
     * The functions should be called in the view displayed function : 
     * ```javascript
     * view.displayed = ()=>{
     *    view.manageForm() ;
     * }
     * ```
     * 
     * A property `view.managedForm` will be added to the view
     * 
     * You can call `view.managedForm.validate()` to check the form validity
     * 
     * You need to load data in `loader` and handle `save` and `delete` in the view code
     * 
     * @param {HTMLFormElement} form the form to manage (if not given, search first form in the view)
     * @returns {Bootstrap5HTMLFormElement} managed form
     */
    manageForm(form?: HTMLFormElement): Bootstrap5HTMLFormElement;

    /**
     * Apply the mode to the form
     *  if the new mode is `create`, the route params is updated to remove the id
     *  if the new mode is `edit`, the data are refreshed and mode set to edit
     *  if the new mode is `read`, 
     *      if the previous mode was `create`, go back in history
     *      if the previous mode was `edit`, the data are refreshed and mode set to read
     * 
     * @param mode the mode of the form can be "read", "edit", "create"
     */
    formMode(mode: string): Promise<void>;

    /**
     * The form element managed by the view
     * 
     * It is created by the `manageForm` function
     */
    managedForm: Bootstrap5HTMLFormElement;

    /**
     * Perform validation of the fields of the form
     * 
     * If the form contains an element `.form-feedback`the validation message will be displayed in this element.
     * 
     * The validations messaged are also displayed under each form element
     * 
     * @param form the form element to validate (if not provided give the first form element found in the view)
     * @returns true if the form is valid, false otherwise
     */
    validateForm(form?: HTMLFormElement): boolean;
}


declare const bootstrap: Bootstrap5;
declare const dialogs: Bootstrap5DialogsViewZ;
