// constantes globales
DOWN = 0;
UP = 1;

let jsLift = {

    /* 
    * constantes
    */
    
    // sim
    DT : 100, // [ms]
    MAX_TIME_MULT : 32, // vitesse max (valeur max de timeMult)
    MIN_TIME_MULT : 1,
    STATE_STOP : 0,
    STATE_RUN : 1,

    // états lifts
    MOVING : 0,
    OPENING_DOORS : 1,
    UNLOADING: 2,
    LOADING: 3,
    CLOSING_DOORS: 4,
    STOPPED: 5,

    // paramètres sim
    WAITING_QUEUE_MAX_LENGTH : 10, // taille maximale d'une file d'attente
    LIFT_MAX_CAPACITY : 5,

    // dimensions dessins
    FLOOR_HEIGHT : 40, // hauteur d'un étage/lift [px]
    PERSON_RADIUS : 5, // rayon d'une personne [px]
    PERSON_X_SPACE : 2, // espace horizontal entre deux personnes [px]
    LIFT_WIDTH : 60, // largeur d'un lift [px]
    LIFT_X_SPACE : 20, // espace horizontal entre deux lifts [px]
    LIFT0_X : 200, // coordonnée x du 1er lift (tout à gauche)
    CANVAS_WIDTH : 600, // largeur du canvas [px]
    CANVAS_HEIGHT: -1, // hauteur du canvas (calculée au chargement du scénario)

    // couleurs
    BG_COLOR : '#ccf',
    FG_COLOR : '#00f',
    PERSONS_COLOR : '#00f',
    ACTIVE_COLOR : '#9f9',
    INACTIVE_COLOR : '#aac',
    LIFT_BG_COLOR : '#ccc',
    LIFT_FG_COLOR : '#000',
    LIFT_DOORS_COLOR : 'rgba(204,204,204,0.5)',

    // vitesses
    LIFT_Y_SPEED : 5, // pixels/iteration

    /*
    * variables globales
    */
    
    // sim
    simState : this.STATE_STOP,
    tickTimer : false, // timer pour animer la simulation et appeler le script de la joueuse
    tickNum: 0,
    timeMultiplier: 1, // "vitesse" de la simulation

    // lifts
    liftsList : [],
    floorsList : [],

    // scenario
    scenarioNum : 0,
    currentScenario: false, // variable contenant le scénario actuel (depuis liste_scenarii)

    // stats
    nPersonsTransported : 0,
    waitingTimesList : [],

    // dessin
    canvas : false,
    ctx : false,

    /*
    *
    * GESTION PAGE WEB
    *
    */

    init : function(){
        // initialisation de la page

        // initialiser variables
        jsLift.simState = jsLift.STATE_STOP;

        // boutons
        document.querySelector('#btn_demarrer').addEventListener('click',jsLift.startSim);
        document.querySelector('#btn_reset').addEventListener('click',jsLift.resetSim);
        document.querySelector('#btn_dtminus').addEventListener('click',jsLift.decreaseSpeed);
        document.querySelector('#btn_dtplus').addEventListener('click',jsLift.increaseSpeed);

        // canvas
        jsLift.canvas = document.querySelector('#lift_canvas');
        jsLift.ctx = jsLift.canvas.getContext("2d");
    },

    loadScenario: function(){
        // trouver numéro scénario
        let params = new URLSearchParams(document.location.search);
        jsLift.scenarioNum = parseInt(params.get('scenario'));
        if (!jsLift.scenarioNum){
            jsLift.scenarioNum = 1;
        }
        let userFileName = 'playerScripts/lift'+jsLift.scenarioNum+'.js'; // nom du fichier créé par la joueuse

        // màj titre
        document.querySelector('#main_title').innerHTML = 'Scénario n° '+jsLift.scenarioNum;
        // màj liens
        if(jsLift.scenarioNum > 1){
            document.querySelector('#a_prev').style.visibility = 'visible';
            document.querySelector('#a_prev').setAttribute('href','jsLift.html?scenario='+(jsLift.scenarioNum-1));
        }
        else{
            document.querySelector('#a_prev').style.visibility = 'hidden';
        }
        document.querySelector('#a_next').setAttribute('href','jsLift.html?scenario='+(jsLift.scenarioNum+1));

        // charger infos du scénario
        if (liste_scenarii.length < jsLift.scenarioNum){
            // pbm: le scénario X n'existe pas
            jsLift.setStatus(`le scénario ${jsLift.scenarioNum} n'existe pas`);
        }
        else{
            jsLift.currentScenario = liste_scenarii[jsLift.scenarioNum-1];
            document.querySelector('#div_description').innerHTML = jsLift.currentScenario['description'];

            // adapter hauteur canevas
            jsLift.CANVAS_HEIGHT = jsLift.currentScenario.nFloors * jsLift.FLOOR_HEIGHT
            jsLift.canvas.height = jsLift.CANVAS_HEIGHT ;

            // initialiser scénario
            jsLift.initScenario();

            // charger fichier de solution correspondant au scénario ("liftX.js")
            // https://stackoverflow.com/questions/21294/dynamically-load-a-javascript-file
            let head = document.querySelector('head');
            let userScript = document.createElement('script');
            userScript.type = 'text/javascript';
            userScript.src = userFileName;
            userScript.onreadystatechange = jsLift.clearStatus;
            userScript.onload = jsLift.clearStatus;
            jsLift.setStatus(`chargement du fichier ${userFileName} ...`)
            head.appendChild(userScript);
        }

    },

    loadPlaygroundScenario: function(){
        // charge un scénario "vide" pour tester les fonctions
        jsLift.currentScenario = {
            'nFloors':5,
            'nLifts':2,
            'spawnProbFromGF': .1,
            'spawnProbToGF': .05,
            'spawnProbOther': .01,
        };

        // adapter hauteur canevas
        jsLift.CANVAS_HEIGHT = jsLift.currentScenario.nFloors * jsLift.FLOOR_HEIGHT
        jsLift.canvas.height = jsLift.CANVAS_HEIGHT ;

        // initialiser scénario
        jsLift.initScenario();

    },

    initScenario: function(){
        // initialiser/reset scénario

        // vitesse
        jsLift.timeMultiplier = 1;
        jsLift.updateSpeedControl();

        // créer matrice spawnProb
        if(!('spawnProbMatrix' in jsLift.currentScenario)){
            let spawnProbMatrix = [];
            let nFloors = jsLift.currentScenario.nFloors;
            // rez-de-chaussée
            let arrayGf = [0];
            for(let f=1;f<nFloors;f++){
                arrayGf.push(jsLift.currentScenario.spawnProbFromGF);
            }
            spawnProbMatrix.push(arrayGf);
            for(let floorFrom=1;floorFrom<nFloors;floorFrom++){
                let arrayF = [jsLift.currentScenario.spawnProbToGF];
                for(let floorTo=1;floorTo<nFloors;floorTo++){
                    if(floorFrom==floorTo){
                        arrayF.push(0);
                    }
                    else{
                        arrayF.push(jsLift.currentScenario.spawnProbOther);
                    }
                }
                spawnProbMatrix.push(arrayF);
            }
            jsLift.currentScenario.spawnProbMatrix = spawnProbMatrix;
        }

        // lifts
        jsLift.liftsList = [];
        for(let l=0;l<jsLift.currentScenario.nLifts;l++){
            jsLift.liftsList.push(new Lift(l));
        }

        // floors
        // reset listes étages
        jsLift.floorsList = [];
        for(let f=0;f<jsLift.currentScenario.nFloors;f++){
            jsLift.floorsList.push(new Floor(f,jsLift.currentScenario.nLifts));
        }

        jsLift.tickNum = 0;
        jsLift.waitingTimesList = [];

        jsLift.drawAll();
    },

    setStatus : function(txt){
        // affiche un message sur la div 'div_status' et efface le message précédent
        document.querySelector('#div_status').innerHTML = txt;
        document.querySelector('#div_status').style.display = 'block';
    },

    clearStatus : function(){
        // efface le contenu de la div 'div_status'
        jsLift.setStatus('');
        document.querySelector('#div_status').style.display = 'none';
    },
    
    setConsoleMessage : function(txt){
        // affiche un message sur la div 'div_console'
        document.querySelector('#div_console').innerHTML += txt+'<br>';
    },

    setConsoleMessageFct: function(txt){
        // affiche un message d'appel à une fonction sur la div 'div_console'
        document.querySelector('#div_console').innerHTML += '<span class="fct_msg">&gt; &nbsp;'+txt+':</span><br>';
    },

    setConsoleError : function(txt){
        // affiche un message d'erreur sur la div 'div_console'
        document.querySelector('#div_console').innerHTML += '<span class="error_msg">ERREUR: '+txt+'</span><br>';
    },

    clearConsole: function(){
        document.querySelector('#div_console').innerHTML = '';
    },

    updateSpeedControl: function(){
        // màj le "facteur temps" et active/désactive les boutons +/-
        document.querySelector('#span_dt').innerHTML = jsLift.timeMultiplier;
        if(jsLift.timeMultiplier>jsLift.MIN_TIME_MULT){
            document.querySelector('#btn_dtminus').removeAttribute("disabled");
        }
        else{
            document.querySelector('#btn_dtminus').setAttribute("disabled","disabled");
        }
        if(jsLift.timeMultiplier<jsLift.MAX_TIME_MULT){
            document.querySelector('#btn_dtplus').removeAttribute("disabled");
        }
        else{
            document.querySelector('#btn_dtplus').setAttribute("disabled","disabled");
        }

    },

    /*
    *
    * GESTION SIMULATION
    *
    */

    startSim : function(){
        // démarre et arrête la simulation

        if (jsLift.simState==jsLift.STATE_STOP){
            // démarre la simulation
            jsLift.tryCallInit();
            jsLift.simState = jsLift.STATE_RUN;
            document.querySelector('#btn_demarrer').innerHTML = 'arrêter';
            jsLift.tickTimer = setInterval(jsLift.tick,jsLift.DT/jsLift.timeMultiplier);
        }
        else{
            //console.log('stop sim');
            jsLift.simState = jsLift.STATE_STOP;
            clearInterval(jsLift.tickTimer);
            document.querySelector('#btn_demarrer').innerHTML = 'démarrer';
        }

    },

    resetSim: function(){
        if (jsLift.simState==jsLift.STATE_RUN){
            jsLift.simState = jsLift.STATE_STOP;
            clearInterval(jsLift.tickTimer);
            document.querySelector('#btn_demarrer').innerHTML = 'démarrer';
        }
        jsLift.clearConsole();
        jsLift.initScenario();
    },

    updateSimSpeed: function(){
        if (jsLift.simState==jsLift.STATE_RUN){
            clearInterval(jsLift.tickTimer);
            jsLift.tickTimer = setInterval(jsLift.tick,jsLift.DT/jsLift.timeMultiplier);
        }
    },

    increaseSpeed: function(){
        if(jsLift.timeMultiplier < jsLift.MAX_TIME_MULT){
            jsLift.timeMultiplier *= 2;
            jsLift.updateSimSpeed();
        }
        jsLift.updateSpeedControl();
    },

    decreaseSpeed: function(){
        if(jsLift.timeMultiplier > jsLift.MIN_TIME_MULT){
            jsLift.timeMultiplier /= 2;
            jsLift.updateSimSpeed();
        }
        jsLift.updateSpeedControl();
    },

    tick: function(){
        // fonction qui fait une itération de la simulation
        jsLift.tickNum++;

        //console.log('appel animateSim()');
        jsLift.animateSim();

        // appel du script de la joueuse tous les 10 ticks
        jsLift.tryCallStep();

        // màj stats
        jsLift.updateStats();
    },

    animateSim : function(){
        // fonction principale pour animer la sim, appelée à intervalle régulier
        //console.log('step anim');

        // générer individus
        jsLift.floorsList.forEach(floor=>{
            floor.animate();
        });

        // animer lift(s)
        jsLift.liftsList.forEach((lift) => {
            lift.animate();
        });

        // bouger
        // appeler fonction / créer évènement "liftAtFloor"

        // redessiner
        jsLift.drawAll();

    },

    getPersonFromWaitingQueue: function(floorNumber, liftNumber){
        let floor = jsLift.getFloorObjectById(floorNumber);
        //console.log(floor);
        let buttonUp = floor.getLiftLightState(liftNumber,UP);
        let buttonDown = floor.getLiftLightState(liftNumber,DOWN);
        let selectUp = true;
        let selectDown = true;
        if(buttonUp && !buttonDown){
            selectUp = true;
            selectDown = false;
        }
        else if(buttonDown && !buttonUp){
            selectDown = true;
            selectUp = false;
        }
        return floor.getPersonFromWaitingQueue(selectUp, selectDown);
    },

    deliverPassengerAtFloor: function(floorNumber, passenger){
        //console.log(`passager amené à l\'étage ${floorNumber}`);
        // TODO: vérifier floor id ?
        let timeSpent = jsLift.tickNum - passenger.getSpawnTime();
        jsLift.waitingTimesList.push(timeSpent);
        //console.log(`jsLift.tickNum: ${jsLift.tickNum}`);
        //console.log(`passenger.getSpawnTime(): ${passenger.getSpawnTime()}`);
        //console.log(`time spent: ${timeSpent}`);
    },

    updateStats: function(){
        let elapsedTime = Math.round(100*jsLift.tickNum*jsLift.DT/1000)/100;
        let nPersonsTransported = jsLift.waitingTimesList.length;
        let avgTimeSeconds = '-';
        let maxTimeSeconds = '-';

        if(jsLift.waitingTimesList.length>0){
            let maxTimeTick = 0;
            let totalTimeTick = 0;
            jsLift.waitingTimesList.forEach(t => {
                totalTimeTick += t;
                if(t>maxTimeTick){
                    maxTimeTick = t;
                }
            });
            let avgTimeTick = totalTimeTick/nPersonsTransported;
            avgTimeSeconds = Math.round(100*avgTimeTick*jsLift.DT/1000)/100;
            maxTimeSeconds = Math.round(100*maxTimeTick*jsLift.DT/1000)/100;
        }

        document.querySelector('#span_stats_time_elapsed').innerHTML = elapsedTime;
        document.querySelector('#span_stats_persons_transported').innerHTML = nPersonsTransported;
        document.querySelector('#span_stats_avg_waiting_time').innerHTML = avgTimeSeconds;
        document.querySelector('#span_stats_max_waiting_time').innerHTML = maxTimeSeconds;

    },

    /*
    * DESSIN CANVAS
    */

    drawAll: function(){
        // dessine tout le canvas

        // dessine le fond
        jsLift.ctx.save();
        jsLift.ctx.fillStyle = jsLift.BG_COLOR;
        jsLift.ctx.beginPath();
        jsLift.ctx.rect(-10,-10,jsLift.CANVAS_WIDTH+20,jsLift.CANVAS_HEIGHT+20);
        jsLift.ctx.fill();
        jsLift.ctx.restore();

        // étages + queues + boutons étages
        jsLift.drawFloors();

        // lifts + indicateurs lifts
        jsLift.drawLifts();
    },

    drawFloors: function(){
        // dessine les étages, les queues et les boutons

        jsLift.floorsList.forEach(floor => {
            let floorId = floor.getId();
            let y = jsLift.getFloorYCoordinate(floorId);

            // dessiner bas
            jsLift.ctx.save();
            jsLift.ctx.strokeStyle = jsLift.FG_COLOR;
            jsLift.ctx.lineWidth = 2;
            jsLift.ctx.beginPath();
            jsLift.ctx.moveTo(0, y);
            jsLift.ctx.lineTo(jsLift.CANVAS_WIDTH, y);
            jsLift.ctx.stroke();
            jsLift.ctx.restore();

            // dessiner n° étage
            jsLift.ctx.save();
            jsLift.ctx.fillStyle = jsLift.FG_COLOR;
            jsLift.ctx.font = "bold 30px sans-serif";
            jsLift.ctx.fillText(floorId, 10, y);
            jsLift.ctx.restore();

            // dessiner boutons
            if (floorId>0){
                jsLift.drawFloorButton(floorId,DOWN,floor.getButtonState(DOWN));
            }
            if(floorId<jsLift.currentScenario.nFloors-1){
                jsLift.drawFloorButton(floorId,UP,floor.getButtonState(UP));
            }

            // dessiner queue
            let waitingQueue = floor.getWaitingQueue();
            waitingQueue.forEach((person, index) => {
                jsLift.ctx.save();
                jsLift.ctx.fillStyle = jsLift.PERSONS_COLOR;
                jsLift.ctx.beginPath();
                jsLift.ctx.ellipse(jsLift.LIFT0_X-index*(jsLift.PERSON_RADIUS*2+jsLift.PERSON_X_SPACE)-10,y-jsLift.PERSON_RADIUS-5,jsLift.PERSON_RADIUS,jsLift.PERSON_RADIUS,0,0,2*Math.PI);
                jsLift.ctx.fill();
                jsLift.ctx.restore();
            });

            // dessiner lumières lifts
            for(let l=0;l<jsLift.currentScenario.nLifts;l++){
                jsLift.drawLiftLight(floorId,l,UP,floor.getLiftLightState(l,UP));
                jsLift.drawLiftLight(floorId,l,DOWN,floor.getLiftLightState(l,DOWN));
            }
        });

    },

    drawFloorButton: function(f, direction, active){
        // dessine le bouton pour monter/descendre
        let x = 35;
        let y = jsLift.getFloorYCoordinate(f)-(jsLift.FLOOR_HEIGHT/2)+8;
        if (direction==UP){
            y = jsLift.getFloorYCoordinate(f)-(jsLift.FLOOR_HEIGHT/2)-8;
        }

        jsLift.ctx.save();

        // dessiner fond
        if (active){
            jsLift.ctx.fillStyle = jsLift.ACTIVE_COLOR;
        }
        else{
            jsLift.ctx.fillStyle = jsLift.INACTIVE_COLOR;
        }
        jsLift.ctx.beginPath();
        jsLift.ctx.ellipse(x, y, 7, 7, 0, 0, 2*Math.PI);
        jsLift.ctx.fill();

        // dessiner flèche
        jsLift.ctx.strokeStyle = jsLift.BG_COLOR;
        jsLift.ctx.lineWidth = 3;
        jsLift.ctx.lineJoin = "round";
        jsLift.ctx.beginPath();
        if (direction==UP){
            jsLift.ctx.moveTo(x-4, y+2);
            jsLift.ctx.lineTo(x, y-2);
            jsLift.ctx.lineTo(x+4, y+2);
        }
        else{
            jsLift.ctx.moveTo(x-4, y-2);
            jsLift.ctx.lineTo(x, y+2);
            jsLift.ctx.lineTo(x+4, y-2);
        }
        jsLift.ctx.stroke();

        jsLift.ctx.restore();

    },

    drawLiftLight: function(floorNumber, liftNumber, direction, active){
        // dessine les lumières (up/down) de l'ascneseur liftNumber à l'étage floorNumber
        
        jsLift.ctx.save();

        if (active){
            jsLift.ctx.fillStyle = jsLift.ACTIVE_COLOR;
        }
        else{
            jsLift.ctx.fillStyle = jsLift.INACTIVE_COLOR;
        }
        let x_max = jsLift.LIFT0_X+liftNumber*(jsLift.LIFT_WIDTH+jsLift.LIFT_X_SPACE);
        let y_min = (jsLift.currentScenario.nFloors-floorNumber-1)*jsLift.FLOOR_HEIGHT;

        jsLift.ctx.beginPath();
        if(direction==UP){
            jsLift.ctx.moveTo(x_max-12,y_min+12);
            jsLift.ctx.lineTo(x_max-7,y_min+2);
            jsLift.ctx.lineTo(x_max-2,y_min+12);

        }
        if(direction==DOWN){
            jsLift.ctx.moveTo(x_max-12,y_min+14);
            jsLift.ctx.lineTo(x_max-7,y_min+24);
            jsLift.ctx.lineTo(x_max-2,y_min+14);
        }
        jsLift.ctx.fill();
        
        jsLift.ctx.restore();
    },

    drawLifts: function(){
        // //console.log('draw lifts');

        // lifts
        jsLift.liftsList.forEach(lift => {
            let x_from = jsLift.LIFT0_X+lift.getId()*(jsLift.LIFT_WIDTH+jsLift.LIFT_X_SPACE);
            let y_from = jsLift.currentScenario.nFloors*jsLift.FLOOR_HEIGHT-lift.getHeight()-jsLift.FLOOR_HEIGHT;

            // lift
            jsLift.ctx.save();
            jsLift.ctx.fillStyle = jsLift.LIFT_BG_COLOR;
            jsLift.ctx.strokeStyle = jsLift.LIFT_FG_COLOR;
            jsLift.ctx.lineWidth = 3;

            jsLift.ctx.beginPath();
            jsLift.ctx.rect(x_from, y_from, jsLift.LIFT_WIDTH, jsLift.FLOOR_HEIGHT );
            jsLift.ctx.stroke();
            jsLift.ctx.fill();

            jsLift.ctx.restore();

            // personnages dans le lift
            let nPersons = lift.getPassengersCount();
            for(let p=0;p<nPersons;p++){
                jsLift.ctx.save();
                jsLift.ctx.fillStyle = jsLift.PERSONS_COLOR;
                jsLift.ctx.beginPath();
                jsLift.ctx.ellipse(x_from + p*(jsLift.PERSON_RADIUS*2+jsLift.PERSON_X_SPACE)+5,y_from+jsLift.FLOOR_HEIGHT-jsLift.PERSON_RADIUS-5,jsLift.PERSON_RADIUS,jsLift.PERSON_RADIUS,0,0,2*Math.PI);
                jsLift.ctx.fill();
                jsLift.ctx.restore();
            }


            // numéros des étages
            let buttons = lift.getButtonsList();
            let x_from_text = x_from+1;
            let y_from_text = y_from+9;
            let dy=0;
            let dx=0;
            for(let f=0;f<jsLift.floorsList.length;f++){
                jsLift.ctx.save();
                if(buttons[f]){
                    jsLift.ctx.fillStyle = jsLift.ACTIVE_COLOR;
                }
                else{
                    jsLift.ctx.fillStyle = jsLift.INACTIVE_COLOR;
                }
                jsLift.ctx.font = "10px sans-serif";
                let textWidth = jsLift.ctx.measureText(f).width;
                if(dx+textWidth+1 > jsLift.LIFT_WIDTH){
                    dy += 11;
                    dx = 0;
                }
                jsLift.ctx.fillText(f, x_from_text+dx, y_from_text+dy);
                dx += textWidth+1;
                jsLift.ctx.restore();
            }


            // portes
            jsLift.ctx.save();
            jsLift.ctx.fillStyle = jsLift.LIFT_DOORS_COLOR;
            jsLift.ctx.strokeStyle = jsLift.LIFT_FG_COLOR;
            jsLift.ctx.beginPath();
            let doorsWidth = (lift.getDoorsClosingState()/100)*jsLift.LIFT_WIDTH/2;
            jsLift.ctx.rect(x_from,y_from,doorsWidth,jsLift.FLOOR_HEIGHT);
            jsLift.ctx.rect(x_from+jsLift.LIFT_WIDTH-doorsWidth,y_from,doorsWidth,jsLift.FLOOR_HEIGHT);
            jsLift.ctx.fill();
            jsLift.ctx.stroke();

            jsLift.ctx.restore();
        });

    },

    /*
    * UTILITAIRES
    */

    getFloorYCoordinate: function(floorNumber){
        // renvoie la coordonnées y de l'étage floorNumber
        return (jsLift.currentScenario.nFloors-floorNumber)*jsLift.FLOOR_HEIGHT;
    },

    getFloorNumber: function(height){
        // renvoie le numéro de l'étage à partir de la hauteur
        if(Number.isInteger(height/jsLift.FLOOR_HEIGHT)){
            return height/jsLift.FLOOR_HEIGHT;
        }
        else{
            return -1;
        }
    },

    getFloorObjectById: function(floorId){
        // renvoie l'objet floor dont l'id est floorId
        for(let f=0;f<jsLift.floorsList.length;f++){
            if(jsLift.floorsList[f].getId()==floorId){
                return jsLift.floorsList[f];
            }
        }
        return false;
    },
    
    isLiftAtFloor: function(liftHeight, floorNumber){
        return jsLift.CANVAS_HEIGHT-liftHeight == jsLift.getFloorYCoordinate(floorNumber);
    },
    
    isLiftBelowFloor: function(liftHeight, floorNumber){
        return jsLift.CANVAS_HEIGHT-liftHeight > jsLift.getFloorYCoordinate(floorNumber);
    },

    /*
    * INTERFACE AVEC LE SCRIPT DE LA JOUEUSE
    */

    tryCallInit: function(){
        if (typeof gererLiftInit == 'function'){
            gererLiftInit();     
        }
    },

    tryCallStep: function(){
        if (typeof gererLiftStep == 'function'){
            gererLiftStep();     
        }
    },

    tryCallLiftArrivesAtFloor: function(liftNumber, floorNumber){
        if (typeof liftArrivesAtFloor == 'function'){
            liftArrivesAtFloor(liftNumber,floorNumber);     
        }

    },

    tryCallButtonIsPressed: function(floorNumber, direction){
        if (typeof buttonIsPressed == 'function'){
            buttonIsPressed(floorNumber,direction);     
        }
    },

    tryCallLiftLeavesFloor: function(liftNumber, floorNumber){
        if (typeof liftLeavesFloor == 'function'){
            liftLeavesFloor(liftNumber,floorNumber);  
        }

    },

    tryCallLiftIsIdle: function(liftNumber){
        if (typeof liftIsIdle == 'function'){
            liftIsIdle(liftNumber);  
        }

    },
    
    validateLiftNum : function(n,f){
        if (n < jsLift.liftsList.length){
            return true;
        }
        else{
            jsLift.setConsoleError(`${f}: le lift ${n} n'existe pas.`);
            return false;
        }
    },
    
    validateFloorNum : function(n,f){
        if (n < jsLift.currentScenario.nFloors){
            return true;
        }
        else{
            jsLift.setConsoleError(`${f}: l'étage ${n} n'existe pas.`);
            return false;
        }
    },

    validateDirection: function(d,f){
        if(d==UP || d==DOWN){
            return true;
        }
        else{
            jsLift.setConsoleError(`${f}: direction invalide (utilisez UP ou DOWN).`);
            return false;
        }
    }


};

/*
* INTERFACE
*/

function liftGoTo(liftNumber,floorNumber){
    // envoie immédiatement le lift liftNumber à l'étage floorNumber sans arrêt
    jsLift.setConsoleMessageFct(`liftGoTo(${liftNumber},${floorNumber})`);
    if (jsLift.validateLiftNum(liftNumber,'liftGoTo') && jsLift.validateFloorNum(floorNumber,'liftGoTo')){
        jsLift.liftsList[liftNumber].setDestinationCycle(false);
        jsLift.liftsList[liftNumber].setDestinationList([floorNumber]);jsLift.setConsoleMessage(`l'ascenseur ${liftNumber} va à l'étage ${floorNumber}`,`liftGoTo(${liftNumber},${floorNumber})`);
    }
}

function liftSetDestinationList(liftNumber,destinationList,cycle = false){
    // applique la liste destinationList au lift liftNumber
    // si cycle=true, la liste de destinations est appliquée en boucle
    jsLift.setConsoleMessageFct(`liftSetDestinationList(${liftNumber},[${destinationList}],[${cycle}])`);
    if (jsLift.validateLiftNum(liftNumber,'liftSetDestinationList')){
        let allFloorsExist = true;
        for(let i=0;i<destinationList.length;i++){
            if(!jsLift.validateFloorNum(destinationList[i],'liftSetDestinationList')){
                allFloorsExist = false;
                break;
            }
        }
        if(allFloorsExist){
            jsLift.liftsList[liftNumber].setDestinationList(destinationList);
            jsLift.liftsList[liftNumber].setDestinationCycle(cycle);
            jsLift.setConsoleMessage(` l'ascenseur ${liftNumber} a comme destination(s) [${jsLift.liftsList[liftNumber].getDestinationList()}]`);

        }
    }
}

function liftAddDestinationAtStart(liftNumber, floorNumber){
    // ajoute une destination au DEBUT de destinationList
    // !!! si cycle=true, destinationList change à chaque étage
    jsLift.setConsoleMessageFct(`liftAddDestinationAtStart(${liftNumber},${floorNumber})`);
    if (jsLift.validateLiftNum(liftNumber,'liftAddDestinationAtStart') && jsLift.validateFloorNum(floorNumber,'liftAddDestinationAtStart')){
        jsLift.liftsList[liftNumber].addDestinationAtStart(floorNumber);
        jsLift.setConsoleMessage(` l'ascenseur ${liftNumber} a comme destination(s) [${jsLift.liftsList[liftNumber].getDestinationList()}]`);
    }
}

function liftAddDestinationAtEnd(liftNumber, floorNumber){
    // ajoute une destination à la FIN de destinationList
    // !!! si cycle=true, destinationList change à chaque étage
    jsLift.setConsoleMessageFct(`liftAddDestinationAtEnd(${liftNumber},${floorNumber})`);
    if (jsLift.validateLiftNum(liftNumber,'liftAddDestinationAtEnd') && jsLift.validateFloorNum(floorNumber,'liftAddDestinationAtEnd')){
        jsLift.liftsList[liftNumber].addDestinationAtEnd(floorNumber);
        jsLift.setConsoleMessage(` l'ascenseur ${liftNumber} a comme destination(s) [${jsLift.liftsList[liftNumber].getDestinationList()}]`);
    }
}

function floorSetLiftLight(floorNumber, liftNumber, direction, state){
    // allume (si state vaut true) ou éteint (si state vaut false) la lumière de l'ascenseur liftNumber à l'étage floorNumber dans la direction direction (UP ou DOWN)
    //jsLift.setConsoleMessageFct(`floorSetLiftLight(${floorNumber},${liftNumber},${direction},${state})`);
    if (jsLift.validateLiftNum(liftNumber,'floorSetLiftLight') && jsLift.validateFloorNum(floorNumber,'floorSetLiftLight') && jsLift.validateDirection(direction,'floorSetLiftLight')){
        jsLift.floorsList[floorNumber].setLiftLightState(liftNumber,direction,state);
        //let directionString=(direction==UP?'UP':'DOWN');
        //let stateString=(state==true?'true':'false');
        //jsLift.setConsoleMessage(` la lumière de l'ascenseur ${liftNumber} à l'étage ${floorNumber} dans la direction ${directionString} a la valeur ${stateString}`);
    }

}

function updateLiftLights(liftNumber){
    // met à jour toutes les lumières de tous les étages
    //jsLift.setConsoleMessageFct(`updateLiftLights(${liftNumber})`);
    if (jsLift.validateLiftNum(liftNumber,'updateLiftLight')){
        let floor = jsLift.getFloorNumber(jsLift.liftsList[liftNumber].getHeight());

        for(let f=0;f<jsLift.currentScenario.nFloors;f++){
            // éteint les autres lumières
            jsLift.floorsList[f].setLiftLightState(liftNumber,UP,false);
            jsLift.floorsList[f].setLiftLightState(liftNumber,DOWN,false);

            if(f==floor){
                // màj les lumières de l'étage actuel
                let destinationList = jsLift.liftsList[liftNumber].getDestinationList();
                let nextDestination = -1;
                if(destinationList.length){
                    if(destinationList[0]!=f){
                        nextDestination = destinationList[0];
                    }
                    else if(destinationList.length>1){
                        // destinationList pas encore mise à jour (destination[0]==f, l'ascenseur vient juste d'arriver)
                        nextDestination = destinationList[1];
                    }
                
                }
                if(nextDestination>=0){
                    if(nextDestination>floor){
                        jsLift.floorsList[f].setLiftLightState(liftNumber,UP,true);
                        jsLift.floorsList[f].setLiftLightState(liftNumber,DOWN,false);
                    }
                    else{
                        jsLift.floorsList[f].setLiftLightState(liftNumber,UP,false);
                        jsLift.floorsList[f].setLiftLightState(liftNumber,DOWN,true);
                    }
                    continue;
                }
            }
        }
        //jsLift.setConsoleMessage(` toutes les lumières de l'ascenseur ${liftNumber} sont à jour`);
    }
}

function getNFloors(){
    // renvoie le nombre d'étages
    return jsLift.currentScenario.nFloors;
}

function getFloorButtonState(floorNumber, direction){
    // renvoie l'état du bouton de l'étage floorNumber dans la direction UP ou DOWN (renvoie true ou false)
    if(jsLift.validateFloorNum(floorNumber,'getFloorButtonState') && jsLift.validateDirection(direction, 'getFloorButtonState')){
        return jsLift.floorsList[floorNumber].getButtonState(direction);
    }
}

function getLiftButtonState(liftNumber, floorNumber){
    // renvoie l'état du bouton de l'ascenseur liftNumber pour aller à l'étage floorNumber (renvoie true ou false)
    if(jsLift.validateLiftNum(liftNumber,'getLiftButtonState') && jsLift.validateFloorNum(floorNumber, 'getLiftButtonState')){
        return jsLift.liftsList[liftNumber].getButtonState(floorNumber);
    }

}

function isLiftAtFloor(liftNumber, floorNumber){
    // renvoie true si le lift liftNumber est à l'étage floorNumber
    if (jsLift.validateLiftNum(liftNumber,'isLiftAtFloor') && jsLift.validateFloorNum(floorNumber,'isLiftAtFloor')){
        return jsLift.isLiftAtFloor(jsLift.liftsList[liftNumber].getHeight(),floorNumber);
    }
}

function getLiftLoad(liftNumber){
    // renvoie la charge actuelle de l'ascenseur liftNumber (0=vide / 1=plein)
    if (jsLift.validateLiftNum(liftNumber,'getLiftLoad')){
        return jsLift.liftsList[liftNumber].getLoad();
    }
}