import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';

const VIDEO_W=240;
const VIDEO_H=135;

const __P = (e:any)=>{
    e.stopPropagation();
    e.preventDefault();
}

class WebexVideo {

    el_options: HTMLImageElement[];
    el_canvas_hide: HTMLCanvasElement;
    el_canvas_hide_context: CanvasRenderingContext2D;
    el_canvas_person: HTMLCanvasElement;
    el_canvas_person_context: CanvasRenderingContext2D;
    el_canvas_background: HTMLCanvasElement;
    el_canvas_background_context: CanvasRenderingContext2D;
    el_video:HTMLVideoElement;
    models:any = {};
    __modeImages: any = {};
    __mode:number=0;
    __clock:any;
    __isRenderStyling:boolean = false;
    __modes:any = {};
    __currentEffect:number=0;
    __styleInputSize:any = [256, 256];
    __drawBokehEffectConfig = {
        backgroundBlurAmount : 3, 
        edgeBlurAmount : 3,
        flipHorizontal : false
    };
    onSelect:any;

    constructor(el_video:HTMLVideoElement, onSelect:any) {
        this.onSelect = onSelect;
        this.el_video  = el_video;
        this.el_options = Array.from(document.querySelectorAll('.item'));
        this.el_canvas_hide = document.getElementById('canvas_hide') as HTMLCanvasElement;
        this.el_canvas_person = document.getElementById('canvas_person') as HTMLCanvasElement;
        this.el_canvas_background = document.getElementById('canvas_background') as HTMLCanvasElement;
        this.el_canvas_hide_context= this.el_canvas_hide.getContext('2d') as CanvasRenderingContext2D;
        this.el_canvas_person_context= this.el_canvas_person.getContext('2d') as CanvasRenderingContext2D;
        this.el_canvas_background_context= this.el_canvas_background.getContext('2d') as CanvasRenderingContext2D;
        this.el_video.width = this.el_canvas_person.width = this.el_canvas_background.width = VIDEO_W;
        this.el_video.height = this.el_canvas_person.height = this.el_canvas_background.height = VIDEO_H;
        this.init();
    }

    init() {
        this.el_options.forEach((el, i)=>{
            el.addEventListener('click', (e)=>{
                this.selectEffect(i);
                __P(e);
            });
            this.__modes[i] = + (el.getAttribute('data-type') || 0);
            if(this.__modes[i]===2) {
                let img = tf.browser.fromPixels(el, 3)
                this.__modeImages[i] = this.compress(img);
                img.dispose()//tf.dispose
            }
        });
    }

    selectEffect(index:number) {
        console.log('select', index);
        this.el_options[this.__currentEffect].className='item';
        this.__currentEffect = index
        this.__mode = this.__modes[index];
        this.el_options[this.__currentEffect].className='item item_selected';
        let isplaying = !!this.__clock;
        if(isplaying) {
            this.stop();            
        }
        if(this.__mode === 3) {
            this.el_canvas_background_context.drawImage(this.el_options[this.__currentEffect], 0, 0, VIDEO_W, VIDEO_H);
        }
        if(isplaying) {
            this.render();
        }
        this.onSelect();
    }

    render_video() {        
        this.el_canvas_person_context.drawImage(this.el_video, 0, 0, VIDEO_W, VIDEO_H);      
    }

    render_person() {
        tf.tidy(()=>{
            let img = tf.browser.fromPixels(this.el_video, 3);
            let content= this.compress(img);
            let result = this.models.segmenter.predict(content);
            let mask = tf.slice(result, [0, 0, 0, 1], -1);
            let person = tf.concat([content, mask], 3);
            let out = this.decompress(person) as tf.Tensor3D;
            tf.browser.toPixels(out, this.el_canvas_person);
            tf.dispose([img, content, result, mask, person, out]);
        });
    }

    render_style() {
        if(!this.__isRenderStyling) {
            this.__isRenderStyling = true;
            tf.tidy(()=>{
                let img = tf.browser.fromPixels(this.el_video, 3);
                let content= this.compress(img);
                let styledImage = this.models.style.execute([this.__modeImages[this.__currentEffect], content]);
                let result = this.decompress(styledImage) as tf.Tensor3D;
                tf.browser.toPixels(result, this.el_canvas_background);
                tf.dispose([img, content, styledImage, result]);
            });            
            this.__isRenderStyling = false;
        }
    }

    __nextRender() {
        this.__clock = requestAnimationFrame(()=>{
            this.render();
        });     
    }

    render() {
        switch(this.__mode) {
            case 0:
                this.render_video();
                break;
            case 1:
                this.render_person();
                break;
            case 2:
                this.render_style();
                this.render_person();
                break;
            case 3:
                this.render_person();
                break;
        }
        this.__nextRender();
    }

    stop() {
        cancelAnimationFrame(this.__clock);
    }

    compress(input: tf.Tensor3D) {
        return tf.tidy(()=>{
            const content= tf.image.resizeNearestNeighbor(input, this.__styleInputSize);
            const normalized = content.div(255.0);
            const batched = normalized.expandDims(0) as tf.Tensor4D;
            tf.dispose([content, normalized]);
            return batched;
        });
    }

    decompress(input: tf.Tensor4D) {
        return tf.tidy(()=>{
            const normalized = input.squeeze() as tf.Tensor3D;
            const output = tf.image.resizeNearestNeighbor(normalized, [VIDEO_H, VIDEO_W]);
            tf.dispose([normalized]);
            return output;
        });
    }

}

class WebexApp {
    el_body: HTMLElement;
    el_panel: HTMLElement;
    el_video_button: HTMLElement;
    el_video_button_text: HTMLElement;
    el_video_button_menu: HTMLElement;
    el_video:HTMLVideoElement;

    el_loading: HTMLElement;
    __isShowPanel:boolean;
    __start:boolean = false;
    __videoStream:any;
    __videoLabelReg = /^FaceTime/i;
    models:any = {};
    webexVideo:WebexVideo;

    constructor() {
        window.onload = ()=>{
            this.init();
            this.initEvent();
            this.initModel();
        }
    }

    init() {
        console.log('Webex Prototype');
        this.el_loading = document.getElementById('loading') as HTMLElement;
        this.el_body = document.querySelectorAll('body')[0];
        this.el_panel = document.getElementById('panel') as HTMLElement;
        this.el_video_button = document.getElementById('video_button') as HTMLElement;
        this.el_video_button_text = document.getElementById('video_button_text') as HTMLElement;
        this.el_video_button_menu = document.getElementById('video_button_menu') as HTMLElement;
        this.el_video = document.getElementById('video') as HTMLVideoElement;
        this.webexVideo = new WebexVideo(this.el_video, ()=>{
            this.hide_panel();
        });
    }

    initEvent() {
        this.hide_panel();
        this.el_body.addEventListener('click', ()=>{
            this.hide_panel()
        });
        this.el_panel.addEventListener('click', (e)=>{
            __P(e);
        });
        this.el_video_button_menu.addEventListener('click', (e)=>{
            if(this.__isShowPanel) {
                this.hide_panel();
            } else {
                this.show_panel();
            }
            __P(e);
        });
        this.el_video_button.addEventListener('click', (e)=>{
            if(this.__start) {
                this.stopVideo();
            } else {
                this.startVideo();
            }
            __P(e);
        });
        this.el_video.addEventListener('playing', () => {
            this.webexVideo.render();
        });
    }

    initModel() {
        tf.ready().then(()=>{
            let todo = 2;
            let callback = ()=>{
                todo--;
                if(todo<=0) {
                    this.el_loading.style.display = 'none';
                }
            };
            let prefix = location.href.indexOf('/ai-demos/dist/')!==-1 ? 'ai-demos/dist/' : '';
            tf.loadGraphModel(`${prefix}style_transfer_tfjs/model.json`).then((m)=>{
                this.webexVideo.models.style = m;
                callback();
            });
            tf.loadGraphModel(`${prefix}seg/model.json`).then((m)=>{
                this.webexVideo.models.segmenter = m;
                console.log(m.inputs);
                callback();
            });       
        });
    }

    show_panel(){
        this.el_panel.style.display='';
        this.__isShowPanel = true;
        this.el_video_button_menu.className= 'menu_button menu_on';
    }

    hide_panel(){
        this.el_panel.style.display='none';
        this.__isShowPanel = false;
        this.el_video_button_menu.className= 'menu_button';
    }
    
    startVideo() {
        this.__start = true;
        this.el_video_button_text.innerHTML = 'Stop video';
        this.webexVideo.__isRenderStyling = false;
        navigator.mediaDevices.enumerateDevices()
        .then((devices)=> {
            let videoDevices = devices.filter((device)=>{
                return device.kind === 'videoinput';
            });
            let faceVideos = videoDevices.filter((device)=>{
                return this.__videoLabelReg.test(device.label);
            })
            if (videoDevices.length > 0) {
                let constraintsID = faceVideos.length>0 ? faceVideos[0].deviceId : videoDevices[0].deviceId
                let constraints = {
                    video: {
                        deviceId: constraintsID,
                        aspectRatio: 16 / 9
                    }
                };
                navigator.mediaDevices.getUserMedia(constraints)
                .then((stream) => {
                    this.__videoStream = stream;
                    this.el_video.srcObject = stream;
                    this.el_video.play();
                })
                .catch((error)=> {
                    console.error('Error accessing camera: ', error);
                });
            } else {
                console.error('No video devices found.');
            }
            })
            .catch(function (error) {
            console.error('Error enumerating devices: ', error);
        });

    }

    stopVideo() {
        this.__start = false;
        this.el_video_button_text.innerHTML = 'Start video';
        if (this.__videoStream) {
            let tracks = this.__videoStream.getTracks();
            tracks.forEach((track:any)=>{
                track.stop()
            });
        }
        this.el_video.srcObject = null;
        this.el_video.pause();
        this.webexVideo.stop();
    }

}

new WebexApp()