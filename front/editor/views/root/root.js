view.loader = async ()=>{
    const files = await bamz.get("/open-bamz-code-editor/files") ;
    return { files } ;
}

view.initCollapses = ()=>{
    const collapses = Array.from(view.querySelectorAll(".collapse")) ;
    for(let collapseElm of collapses){
        if(collapseElm.hasAttribute("bs-initialized")){
            continue ;
        }
        const collapse = new bootstrap.bootstrap.Collapse(collapseElm, {toggle: false}) ;
        const button = view.querySelector(`[data-bs-target="#${collapseElm.id}"]`) ;
        button.addEventListener("click", ()=>{
            collapse.toggle() ;
        }) ;
        collapseElm.setAttribute("bs-initialized", "true")
    } ;

    const dropdowns = Array.from(view.querySelectorAll('.dropdown-toggle')) ;
    for(let dropdownToggleEl of dropdowns){
        const dropdown = new bootstrap.bootstrap.Dropdown(dropdownToggleEl);
        dropdownToggleEl.addEventListener("click", ()=>{
            dropdown.toggle() ;
        }) ;
    }
}

view.displayed = async ()=>{
    view.initCollapses() ;
}