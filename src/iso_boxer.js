/*!
* based on codem-isoboxer v0.3.7 https://github.com/madebyhiro/codem-isoboxer
* I have removed extra methods that were useless in the task (write, etc.), refactored the code, shook the tree,
* and rewrote the code to match the ECMA Object-Oriented scheme.
*/

export class Cursor {
    offset = 0;

    constructor(initialOffset) {
        this.offset = (typeof initialOffset == 'undefined' ? 0 : initialOffset);
    }
}

export class ISOFile {
    constructor(arrayBuffer) {
        this._cursor = new Cursor();
        this.boxes = [];
        if (arrayBuffer) {
            this._raw = new DataView(arrayBuffer);
        }
    }

    parse() {
        this._cursor.offset = 0;
        this.boxes = [];
        while (this._cursor.offset < this._raw.byteLength) {
            let box = ISOBox.parse(this);
            if (typeof box.type !== 'undefined') {
                this.boxes.push(box);
            }
        }
        return this;
    }
}

export class ISOBox {

    _boxContainers = ['moof', 'mfhd', 'traf', 'tfhd', 'trun', 'mdat'];
    _boxProcessors = {
        // ISO/IEC 14496-12:2012 - 8.1.1 Media Data Box
        mdat: () => {
            this._procField('data', 'data', -1);
        },
        // ISO/IEC 14496-12:2012 - 8.8.5 Movie Fragment Header Box
        mfhd: () => {
            this._procFullBox();
            this._procField('sequence_number', 'uint', 32);
        },
        // ISO/IEC 14496-12:2012 - 8.8.7 Track Fragment Header Box
        tfhd: () => {
            this._procFullBox();
            this._procField('track_ID', 'uint', 32);
            if (this.flags & 0x01) this._procField('base_data_offset', 'uint', 64);
            if (this.flags & 0x02) this._procField('sample_description_offset', 'uint', 32);
            if (this.flags & 0x08) this._procField('default_sample_duration', 'uint', 32);
            if (this.flags & 0x10) this._procField('default_sample_size', 'uint', 32);
            if (this.flags & 0x20) this._procField('default_sample_flags', 'uint', 32);
        },
        // ISO/IEC 14496-12:2012 - 8.8.8 Track Run Box
        trun: () => {
            this._procFullBox();
            this._procField('sample_count', 'uint', 32);
            if (this.flags & 0x1) this._procField('data_offset', 'int', 32);
            if (this.flags & 0x4) this._procField('first_sample_flags', 'uint', 32);
            this._procEntries('samples', this.sample_count, function (sample) {
                if (this.flags & 0x100) this._procEntryField(sample, 'sample_duration', 'uint', 32);
                if (this.flags & 0x200) this._procEntryField(sample, 'sample_size', 'uint', 32);
                if (this.flags & 0x400) this._procEntryField(sample, 'sample_flags', 'uint', 32);
                if (this.flags & 0x800) this._procEntryField(sample, 'sample_composition_time_offset', (this.version === 1) ? 'int' : 'uint', 32);
            });
        },
    };
    _cursor;
    _offset = 0;
    _root;
    _raw;
    _parent;

    constructor() {
        this._cursor = new Cursor();
    }

    static parse(parent) {
        const newBox = new ISOBox();
        newBox._offset = parent._cursor.offset;
        newBox._root = (parent._root ? parent._root : parent);
        newBox._raw = parent._raw;
        newBox._parent = parent;
        newBox._parseBox();
        parent._cursor.offset = newBox._raw.byteOffset + newBox._raw.byteLength;
        return newBox;
    }

    _procField(name, type, size) {
        this[name] = this._readField(type, size);
    }

    _procFieldArray(name, length, type, size) {
        this[name] = [];
        for (let i = 0; i < length; i++) {
            this[name][i] = this._readField(type, size);
        }
    }

    _procEntryField(entry, name, type, size) {
        entry[name] = this._readField(type, size);
    }

    _procFullBox() {
        this._procField('version', 'uint', 8);
        this._procField('flags', 'uint', 24);
    }

    _procEntries(name, length, fn) {
        let i;
        if (this._parsing) {
            this[name] = [];
            for (i = 0; i < length; i++) {
                this[name].push({});
                fn.call(this, this[name][i]);
            }
        } else {
            for (i = 0; i < length; i++) {
                fn.call(this, this[name][i]);
            }
        }
    }

    _readField(type, size) {
        switch (type) {
            case 'uint':
                return this._readUint(size);
            case 'int':
                return this._readInt(size);
            case 'string':
                return (size === -1) ? this._readTerminatedString() : this._readString(size);
            case 'data':
                return this._readData(size);
            case 'utf8':
                return this._readUTF8String();
            default:
                return -1;
        }
    }

    _readInt(size) {
        let result = null;
        let offset = this._cursor.offset - this._raw.byteOffset;
        switch (size) {
            case 8:
                result = this._raw.getInt8(offset);
                break;
            case 16:
                result = this._raw.getInt16(offset);
                break;
            case 32:
                result = this._raw.getInt32(offset);
                break;
            case 64:
                // Warning: JavaScript cannot handle 64-bit integers natively.
                // This will give unexpected results for integers >= 2^53
                let s1 = this._raw.getInt32(offset);
                let s2 = this._raw.getInt32(offset + 4);
                result = (s1 * Math.pow(2, 32)) + s2;
                break;
        }
        this._cursor.offset += (size >> 3);
        return result;
    }

    _readUint(size) {
        let result = null;
        let offset = this._cursor.offset - this._raw.byteOffset;
        let s1;
        let s2;
        switch (size) {
            case 8:
                result = this._raw.getUint8(offset);
                break;
            case 16:
                result = this._raw.getUint16(offset);
                break;
            case 24:
                s1 = this._raw.getUint16(offset);
                s2 = this._raw.getUint8(offset + 2);
                result = (s1 << 8) + s2;
                break;
            case 32:
                result = this._raw.getUint32(offset);
                break;
            case 64:
                // Warning: JavaScript cannot handle 64-bit integers natively.
                // This will give unexpected results for integers >= 2^53
                s1 = this._raw.getUint32(offset);
                s2 = this._raw.getUint32(offset + 4);
                result = (s1 * Math.pow(2, 32)) + s2;
                break;
        }
        this._cursor.offset += (size >> 3);
        return result;
    }

    _readString(length) {
        let str = '';
        for (let c = 0; c < length; c++) {
            let char = this._readUint(8);
            str += String.fromCharCode(char);
        }
        return str;
    }

    _readTerminatedString() {
        let str = '';
        while (this._cursor.offset - this._offset < this._raw.byteLength) {
            let char = this._readUint(8);
            if (char == 0) break;
            str += String.fromCharCode(char);
        }
        return str;
    }

    _readData(size) {
        let length = (size > 0) ? size : (this._raw.byteLength - (this._cursor.offset - this._offset));
        if (length > 0) {
            let data = new Uint8Array(this._raw.buffer, this._cursor.offset, length);

            this._cursor.offset += length;
            return data;
        } else {
            return null;
        }
    }

    _readUTF8String() {
        let length = this._raw.byteLength - (this._cursor.offset - this._offset);
        let data = null;
        if (length > 0) {
            data = new DataView(this._raw.buffer, this._cursor.offset, length);
            this._cursor.offset += length;
        }
        return data ? new TextDecoder('utf-8').decode(data) : data;
    }

    _parseBox() {
        this._parsing = true;
        this._cursor.offset = this._offset;

        // return immediately if there are not enough bytes to read the header
        if (this._offset + 8 > this._raw.buffer.byteLength) {
            this._root._incomplete = true;
            return;
        }

        this._procField('size', 'uint', 32);
        this._procField('type', 'string', 4);

        if (this.size === 1) {
            this._procField('largesize', 'uint', 64);
        }
        if (this.type === 'uuid') {
            this._procFieldArray('usertype', 16, 'uint', 8);
        }

        switch (this.size) {
            case 0:
                this._raw = new DataView(this._raw.buffer, this._offset, (this._raw.byteLength - this._cursor.offset + 8));
                break;
            case 1:
                if (this._offset + this.size > this._raw.buffer.byteLength) {
                    this._incomplete = true;
                    this._root._incomplete = true;
                } else {
                    this._raw = new DataView(this._raw.buffer, this._offset, this.largesize);
                }
                break;
            default:
                if (this._offset + this.size > this._raw.buffer.byteLength) {
                    this._incomplete = true;
                    this._root._incomplete = true;
                } else {
                    this._raw = new DataView(this._raw.buffer, this._offset, this.size);
                }
        }

        // additional parsing
        if (!this._incomplete) {
            if (this._boxProcessors[this.type]) {
                this._boxProcessors[this.type].call(this);
            }
            if (this._boxContainers.indexOf(this.type) !== -1) {
                this._parseContainerBox();
            } else {
                // Unknown box => read and store box content
                this._data = this._readData();
            }
        }
    }

    _parseContainerBox() {
        this.boxes = [];
        while (this._cursor.offset - this._raw.byteOffset < this._raw.byteLength) {
            this.boxes.push(ISOBox.parse(this));
        }
    }
}
