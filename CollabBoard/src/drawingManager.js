class DrawingManager {

    // dictionary of drawing records
    // key is the id of the drawing record
    // type is type of the drawing record
    // value is the drawing record

    drawingRecords;    

    constructor() {
        console.log('drawingManager constructor called');
        this.drawingRecords = {};
    }

    CreateNewDrawingRecord(id, type, color, size) {
        this.drawingRecords[id] = {
            type: type,
            color: color,
            size: size,
            points: [],
        };
    }

    getDrawingRecords() {
        return this.drawingRecords;
    }

    clearDrawingRecords() {
        this.drawingRecords = {};
    }
    
    AddPointToRecord(id, point) {
        if (this.drawingRecords[id]) {
            this.drawingRecords[id].points.push(point);
        }
    }

    getDrawingRecord(id) {
        return this.drawingRecords[id];
    }

}

export default DrawingManager;
