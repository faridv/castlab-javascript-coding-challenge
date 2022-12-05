import { ISOFile } from './iso_boxer';

class CastLabsTask {

    mediaUrl = '';

    constructor(mediaUrl) {
        if (typeof mediaUrl !== 'undefined' && mediaUrl) {
            this.mediaUrl = mediaUrl;
        }
        this.fetchMedia();
    }

    fetchMedia() {
        fetch(this.mediaUrl, {})
            .then(response => {
                this.log(`Successfully loaded file ${this.mediaUrl}`);
                return response.blob();
            })
            .then(blob => blob.arrayBuffer())
            .then(arrayBuffer => {
                const parsedBuffer = new ISOFile(arrayBuffer).parse();
                this.handleBoxes(parsedBuffer.boxes);
            });
    }

    handleBoxes(boxes) {
        boxes.forEach(box => {
            this.log(`Found box of type ${box.type} and size ${box.size}`);
            if (typeof box.boxes !== 'undefined' && box.boxes.length) {
                this.handleBoxes(box.boxes);
            }
            if (box.type.toLowerCase() === 'mdat') {
                this.handleMdat(box.data);
            }
        })
    }

    handleMdat(mdatData) {
        const text = new TextDecoder().decode(mdatData);
        this.log('Content of mdat box is: ', text);
        if (text.indexOf('<smpte:image') !== -1) {
            this.renderImages(text);
        }
    }

    renderImages(text) {
        const images = new DOMParser()
            .parseFromString(text, 'application/xml')
            .getElementsByTagName('smpte:image');
        if (images.length) {
            Array.from(images).forEach(image => {
                document.body.appendChild(
                    Object.assign(document.createElement('img'), {
                        src: `data:image/jpeg;base64,${image.innerHTML}`
                    })
                )
            });
        }
    }

    log(...text) {
        console.log(text.join(''));
    }
}


new CastLabsTask("https://demo.castlabs.com/tmp/text0.mp4");
