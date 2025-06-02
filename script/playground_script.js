let evtNum = 0;
window.onload = function () {
    // fonction appelée au chargement de la page
    jsLift.init();
    jsLift.loadPlaygroundScenario();
    jsLift.MIN_TIME_MULT = 1/32;
    jsLift.updateSpeedControl();
    
    document.querySelector('#btn_reset').addEventListener('click',pgReset);

    evtNum = 0;
};

function pgReset(){
    evtNum = 0;
    document.querySelector('#div_pg_evt_console').innerHTML = '';
}

function direction2str(dir){
    return (dir==UP?"UP":"DOWN");
}

// évènements
function gererLiftInit(){
    pgSetConsoleMsg(`gererLiftInit()`);
}
function buttonIsPressed(floorNumber, direction){
    pgSetConsoleMsg(`buttonIsPressed(${floorNumber},${direction2str(direction)})`);
}
function liftArrivesAtFloor(liftNumber, floorNumber){
    pgSetConsoleMsg(`liftArrivesAtFloor(${liftNumber},${floorNumber})`);
}
function liftLeavesFloor(liftNumber, floorNumber){
    pgSetConsoleMsg(`liftLeavesFloor(${liftNumber},${floorNumber})`);
}
function liftIsIdle(liftNumber){
    pgSetConsoleMsg(`liftIsIdle(${liftNumber})`);
}
function pgSetConsoleMsg(txt){
    evtNum++;
    document.querySelector('#div_pg_evt_console').innerHTML = '<div class="pg_evt_num">'+evtNum+'</div><div class="pg_evt_txt">'+txt+'</div>'+document.querySelector('#div_pg_evt_console').innerHTML;
}
// interroger l'environnement
function pg_sim_gFBS(f,d){
    let id=f+"_"+(d==UP?"UP":"DOWN");
    document.querySelector('#sp_gFBS_'+id).innerHTML=(getFloorButtonState(f,d)?"<span class='pg_true'>true</span>":"<span class='pg_false'>false</span>");
}
function pg_sim_iLAT(l,f){
    let id=l+"_"+f;
    document.querySelector('#sp_iLAT_'+id).innerHTML=(isLiftAtFloor(l,f)?"<span class='pg_true'>true</span>":"<span class='pg_false'>false</span>");
}
function pg_sim_gLBS(l,f){
    let id=l+"_"+f;
    document.querySelector('#sp_gLBS_'+id).innerHTML=(getLiftButtonState(l,f)?"<span class='pg_true'>true</span>":"<span class='pg_false'>false</span>");
}
function pg_sim_gLL(l){
    let id=l;
    document.querySelector('#sp_gLL_'+id).innerHTML=getLiftLoad(l);
}