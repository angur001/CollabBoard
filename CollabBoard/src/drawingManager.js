class DrawingManager {

    // dictionary of drawing records
    // key is the id of the drawing record
    // type is type of the drawing record
    // value is the drawing record

    drawingRecords;    
    drawingRecordsHistory; // only ids of the drawing records
    undoneDrawingRecordsHistory; // whole records
    MAX_HISTORY_LENGTH = 10;

    constructor() {
        console.log('drawingManager constructor called');
        this.drawingRecords = {};
        this.drawingRecordsHistory = [];
        this.undoneDrawingRecordsHistory = [];
    }

    CreateNewDrawingRecord(id, type, color, size) {
        this.drawingRecords[id] = {
            type: type,
            color: color,
            size: size,
            points: [],
        };
    }

    CreateTextRecord(id, text, x, y, color, size) {
        this.drawingRecords[id] = {
            type: 'text',
            text: text,
            x: x,
            y: y,
            color: color,
            size: size,
        };
    }

    createTextRecordWithData(id, text, x, y, color, size) {
        this.drawingRecords[id] = {
            type: 'text',
            text: text,
            x: x,
            y: y,
            color: color,
            size: size,
        };
    }

    AddDrawingRecordToHistory(id) {
        this.undoneDrawingRecordsHistory = [];
        
        if (this.drawingRecordsHistory.length < this.MAX_HISTORY_LENGTH) {
            this.drawingRecordsHistory.push(id);
        }
        else {
            this.drawingRecordsHistory.shift();
            this.drawingRecordsHistory.push(id);
        }
    }
    
    canUndo() {
        return this.drawingRecordsHistory.length > 0;
    }
    
    canRedo() {
        return this.undoneDrawingRecordsHistory.length > 0;
    }

    UndoLastDrawingRecord() {
        if (this.drawingRecordsHistory.length > 0) {
            const id = this.drawingRecordsHistory.pop();
            const r = this.drawingRecords[id];
            const record = r.type === 'text'
                ? { id, type: r.type, text: r.text, x: r.x, y: r.y, color: r.color, size: r.size }
                : { id, type: r.type, color: r.color, size: r.size, points: r.points };
            this.undoneDrawingRecordsHistory.push(record);
            delete this.drawingRecords[id];
            return record;
        }
        return null;
    }

    RedoLastDrawingRecord() {
        if (this.undoneDrawingRecordsHistory.length > 0) {
            const record = this.undoneDrawingRecordsHistory.pop();
            if (record.type === 'text') {
                this.drawingRecords[record.id] = {
                    type: 'text',
                    text: record.text,
                    x: record.x,
                    y: record.y,
                    color: record.color,
                    size: record.size,
                };
            } else {
                this.drawingRecords[record.id] = {
                    type: record.type,
                    color: record.color,
                    size: record.size,
                    points: record.points,
                };
            }
            this.drawingRecordsHistory.push(record.id);
            return record;
        }
        return null;
    }

    // Delete a specific record by ID (for remote undo)
    deleteDrawingRecord(id) {
        if (this.drawingRecords[id]) {
            delete this.drawingRecords[id];
        }
    }

    // Create a record with full data (for remote redo)
    createDrawingRecordWithPoints(id, type, color, size, points) {
        this.drawingRecords[id] = {
            type: type,
            color: color,
            size: size,
            points: points,
        };
    }

    getDrawingRecords() {
        return this.drawingRecords;
    }

    clearDrawingRecords() {
        this.drawingRecords = {};
        this.drawingRecordsHistory = [];
        this.undoneDrawingRecordsHistory = [];
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
