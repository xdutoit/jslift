class Lift {
    #id;
    #height;
    #destinationList;
    #destinationCycle;
    #state;
    #doorsClosingState;
    #passengersList;
    #buttonsList;

    constructor(id,height=0){
        this.#id = id; // identifiant du lift
        this.#height = height; // hauteur [px] (depuis l'étage 0)
        this.#destinationList = []; // liste actuelle des étages destinations
        this.#destinationCycle = false; // true: la liste destination est répétée
        this.#state = jsLift.LOADING; // état actuel (STOPPED, MOVING, LOADING, etc.)
        this.#doorsClosingState = 0; // 0 = portes ouvertes / 100 = portes fermées
        this.#passengersList = [];
        this.#buttonsList = [];
        for(let f=0;f<jsLift.nFloors;f++){
            this.#buttonsList.push(false);
        }
    }

    getId(){
        return this.#id;
    }

    getHeight(){
        return this.#height;
    }

    move(dy){
        //console.log(`lift ${this.#id} bouge de ${dy}`);
        this.#height += dy;
    }

    getDestinationList(){
        return this.#destinationList;
    }

    setDestinationList(destinationList){
        this.#destinationList = destinationList;
        this.removeDuplicateDestinations();
    }

    addDestinationAtStart(floor){
        this.#destinationList.unshift(floor);
        this.removeDuplicateDestinations();
    }

    addDestinationAtEnd(floor){
        this.#destinationList.push(floor);
        this.removeDuplicateDestinations();
    }

    removeDuplicateDestinations(){
        for(let d=0;d<this.#destinationList.length;d++){
            let nextD = (d+1)%this.#destinationList.length;
            if(d!=nextD && this.#destinationList[nextD]==this.#destinationList[d]){
                this.#destinationList.splice(d,1);
                d--;
            }
        }
    }

    setDestinationCycle(destinationCycle){
        this.#destinationCycle = destinationCycle;
    }

    getDoorsClosingState(){
        return this.#doorsClosingState;
    }

    getPassengersCount(){
        return this.#passengersList.length;
    }

    updateButtonsList(){
        for(let f=0;f<jsLift.floorsList.length;f++){
            this.#buttonsList[f] = false;
        }
        this.#passengersList.forEach(passenger =>{
            this.#buttonsList[passenger.getFloorTo()] = true;
        });
    }

    getButtonsList(){
        return this.#buttonsList;
    }

    getButtonState(f){
        return this.#buttonsList[f];
    }

    getLoad(){
        let totalWeight = 0;
        this.#passengersList.forEach(p => {
            totalWeight += p.getWeight();
        });
        return Math.round(100*totalWeight/jsLift.LIFT_MAX_CAPACITY)/100;
    }

    animate(){
        // exécute un tick de la simulation
        let currentFloor = jsLift.getFloorNumber(this.#height);
        //console.log(`current floor: ${currentFloor}`);
        switch(this.#state) {
            case jsLift.STOPPED:
                if(this.#destinationList.length){
                    //console.log(`lift ${this.#id} starts moving`);
                    this.#state = jsLift.CLOSING_DOORS;
                }
                break;
            case jsLift.MOVING:
                if(this.#destinationList.length){
                    if( jsLift.isLiftAtFloor(this.#height, this.#destinationList[0]) ){
                        // l'ascenseur est arrivé à destination
                        
                        // màj destinationList
                        let dest = this.#destinationList.shift();
                        if(this.#destinationCycle){
                            this.#destinationList.push(dest);
                        }
                        if(!this.#destinationList.length){
                            //console.log('Dest VIDE');
                            jsLift.tryCallLiftIsIdle(this.#id);
                        }

                        // ouvrir portes
                        this.#state = jsLift.OPENING_DOORS;

                        
                    }
                    else{
                        if( jsLift.isLiftBelowFloor(this.#height, this.#destinationList[0])){
                            this.move(jsLift.LIFT_Y_SPEED);
                        }
                        else{
                            this.move(-jsLift.LIFT_Y_SPEED);
                        }

                        // déclenche l'évènement "liftArrivesAtFloor"
                        if(jsLift.getFloorNumber(this.#height)>=0){
                            jsLift.tryCallLiftArrivesAtFloor(this.#id,jsLift.getFloorNumber(this.#height));
                        }
                    }
                }
                /*else{
                    jsLift.tryCallLiftIsSTOPPED(this.#id);
                    this.#state = jsLift.STOPPED;
                }*/
                break;
            case jsLift.OPENING_DOORS:
                //console.log(`lift ${this.#id} opening doors`);
                if(this.#doorsClosingState == 0){
                    this.#state = jsLift.UNLOADING;
                }
                else{
                    this.#doorsClosingState -= 10;
                }
                break;
            case jsLift.UNLOADING:
                //console.log(`lift ${this.#id} unloading`);
                if(this.#passengersList.length >0){
                    let found = -1;
                    for(let p=this.#passengersList.length-1;p>=0;p--){
                        if(this.#passengersList[p].getFloorTo() == currentFloor){
                            found = p;
                            break;
                        }
                    }
                    if(found>=0){
                        let passengerOut = this.#passengersList.splice(found,1);
                        jsLift.deliverPassengerAtFloor(currentFloor, passengerOut[0]);
                    }
                    else{
                        this.#state = jsLift.LOADING;
                    }
                }
                else{
                    this.#state = jsLift.LOADING;
                }
                break;
            case jsLift.LOADING:
                //console.log(`lift ${this.#id} loading`);
                if(this.#passengersList.length<jsLift.LIFT_MAX_CAPACITY){
                    let personIn = jsLift.getPersonFromWaitingQueue(currentFloor, this.#id);
                    if(personIn){
                        this.#passengersList.push(personIn);
                        break;
                    }
                }
                this.updateButtonsList();
                if(this.#destinationList.length>0){
                    this.#state = jsLift.CLOSING_DOORS;
                }
                break;
            case jsLift.CLOSING_DOORS:
                //console.log(`lift ${this.#id} closing doors`);
                if(this.#doorsClosingState ==100){
                    this.#state = jsLift.MOVING;
                    jsLift.tryCallLiftLeavesFloor(this.#id,jsLift.getFloorNumber(this.#height));
                }
                else{
                    this.#doorsClosingState += 10;
                }
                break;
        }
    }

}

class Floor {
    #id;
    #waitingQueue;
    #buttons;
    #liftLightsList;

    constructor(id,nLifts,waitingQueue=[],buttons=[false,false]){
        this.#id = id; // identifiant de l'étage
        this.#waitingQueue = waitingQueue; // liste des personnes attendant à cet étage
        this.#buttons = buttons; // boutons pour monter/descendre
        let liftLightsList = [];
        for(let l=0;l<nLifts;l++){
            liftLightsList.push([false,false]);
        }
        this.#liftLightsList = liftLightsList;
    }

    getId(){
        return this.#id;
    }

    getButtonState(direction){
        return this.#buttons[direction];
    }

    getLiftLightState(liftId, direction){
        return this.#liftLightsList[liftId][direction];
    }

    setLiftLightState(liftId, direction, state){
        this.#liftLightsList[liftId][direction]=state;
    }

    getPersonFromWaitingQueue(selectUp, selectDown){
        for(let p=0;p<this.#waitingQueue.length;p++){
            if( (this.#waitingQueue[p].getFloorTo()>this.#id && selectUp) || (this.#waitingQueue[p].getFloorTo()<this.#id && selectDown) ){
                let person = this.#waitingQueue.splice(p,1);
                return person[0];
            }
        }
        return false;
    }

    getWaitingQueue(){
        return this.#waitingQueue;
    }

    animate(){
        // crée personnes
        for(let floorTo=0;floorTo < jsLift.currentScenario.nFloors;floorTo++){
            if(floorTo != this.#id){
                if (this.#waitingQueue.length < jsLift.WAITING_QUEUE_MAX_LENGTH && Math.random()*10 < jsLift.currentScenario.spawnProbMatrix[this.#id][floorTo] ){
                    //console.log(`génération perso de ${this.#id} vers ${floorTo}`);
                    this.#waitingQueue.push(new Person(this.#id,floorTo));
                    if(floorTo>this.#id){
                        jsLift.tryCallButtonIsPressed(this.#id,UP);
                    }
                    else{
                        jsLift.tryCallButtonIsPressed(this.#id,DOWN);
                    }
                }
            }
        }

        // màj boutons
        this.#buttons = [false,false];
        this.#waitingQueue.forEach(person => {
            if(person.getFloorTo()>this.#id){
                this.#buttons[UP] = true;
            }
            if(person.getFloorTo()<this.#id){
                this.#buttons[DOWN] = true;
            }
        });
    }

}

class Person {
    #floorFrom;
    #floorTo;
    #spawnTime;
    #weight;

    constructor(floorFrom,floorTo){
        //console.log(`génération perso de ${floorFrom} vers ${floorTo}`);
        this.#floorFrom = floorFrom;
        this.#floorTo = floorTo;
        this.#spawnTime = jsLift.tickNum;
        this.#weight = Math.round(7+Math.random()*4)/10; // poids aléatoire entre 0.7 et 1.1
    }

    getFloorFrom(){
        return this.#floorFrom;
    }

    getFloorTo(){
        return this.#floorTo;
    }

    getSpawnTime(){
        return this.#spawnTime;
    }

    getWeight(){
        return this.#weight;
    }
}
