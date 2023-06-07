import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
const JSZip = require("jszip");

const REGJSON = /\.json$/i;
const REGBIN = /\.bin$/i;
const REGSTYLE = /\/style\//i;

class App {

    href_download:HTMLAnchorElement;
    upload_model:HTMLInputElement;
    upload_content:HTMLInputElement;
    upload_styles:HTMLInputElement;
    con_mask:HTMLElement;
    con_content:HTMLElement;
    con_style:HTMLElement;
    con_outputs:HTMLElement;
    btn_gen:HTMLButtonElement;
    btn_download:HTMLButtonElement;
    el_info:HTMLElement;
    model:any;
    content_size:[number,number] = [256,256];

    constructor() {
        this.init();
        this.initEvent();
    }

    init() {
        this.href_download = document.getElementById('href_download') as HTMLAnchorElement;
        this.upload_model = document.getElementById('upload_model') as HTMLInputElement;
        this.upload_content = document.getElementById('upload_content') as HTMLInputElement;
        this.upload_styles = document.getElementById('upload_styles') as HTMLInputElement;
        this.con_mask = document.getElementById('con_mask') as HTMLElement;
        this.con_content = document.getElementById('con_content') as HTMLElement;
        this.con_style = document.getElementById('con_style') as HTMLElement;
        this.con_outputs = document.getElementById('con_outputs') as HTMLElement;
        this.btn_gen = document.getElementById('btn_gen') as HTMLButtonElement;
        this.btn_download = document.getElementById('btn_download') as HTMLButtonElement;
        this.el_info = document.getElementById('el_info') as HTMLButtonElement;
    }

    initEvent() {
        this.btn_gen.addEventListener('click', ()=>{
            this.gen();
        });
        this.btn_download.addEventListener('click', ()=>{
            this.download();
        });
        this.upload_model.addEventListener('change', ()=>{
            this.uploadModels();
        });
        this.upload_content.addEventListener('change', ()=>{
            this.uploadImages(this.upload_content.files, this.con_content);
        });
        this.upload_styles.addEventListener('change', ()=>{
            this.uploadImages(this.upload_styles.files, this.con_style);
        });
    }

    compress(input: tf.Tensor3D) {
        return tf.tidy(()=>{
            const content= tf.image.resizeNearestNeighbor(input, [256,256]);
            const normalized = content.div(255.0);
            const batched = normalized.expandDims(0) as tf.Tensor4D;
            tf.dispose([content, normalized]);
            return batched;
        });
    }

    decompress(input: tf.Tensor4D) {
        return tf.tidy(()=>{
            const normalized = input.squeeze() as tf.Tensor3D;
            const output = tf.image.resizeNearestNeighbor(normalized, this.content_size);
            tf.dispose([normalized]);
            return output;
        });
    }

    _gen(con: tf.Tensor4D, style: HTMLImageElement) {
        return new Promise((resolve, reject)=>{
            return tf.tidy(()=>{
                const _style = tf.browser.fromPixels(style, 3);
                const styleTF = this.compress(_style);
                const styledImage = this.model.execute([styleTF, con]);
                const result = this.decompress(styledImage) as tf.Tensor3D;
                let canvas = document.createElement('canvas');
                canvas.width = this.content_size[1];
                canvas.height = this.content_size[0];
                this.con_outputs.appendChild(canvas);
                tf.browser.toPixels(result, canvas);
                tf.dispose([_style, styleTF, styledImage, result]);
                tf.keep(con);
                resolve(1);
            });
        });
    }

    gen() {
        let content = Array.from(this.con_content.getElementsByTagName('img'));
        let styles = Array.from(this.con_style.getElementsByTagName('img'));

        if(!this.model) {
            this.log('Load model first!');
        } else if(content.length<1) {
            this.log('Please upload content image');
        } else if(styles.length<1) {
            this.log('Please upload style image');
        } else {
            this.show_mask();
            this.log('');
            let todo = styles.length;
            const _content = tf.browser.fromPixels(content[0], 3);
            this.content_size = [_content.shape[0], _content.shape[1]];
            const contentTF = this.compress(_content);
            _content.dispose();
            let callback = ()=>{
                todo--;
                if(todo<=0) {
                     this.hide_mask();
                     contentTF.dispose();
                }
            }
            this.con_outputs.innerHTML='';
            console.log('start converting', todo);
            styles.forEach((style)=>{
                this._gen(contentTF, style).finally(()=>{
                    callback();
                })
            });
        }
    }

    download() {
        this.show_mask();
        this.log('');
        let outputs = Array.from(this.con_outputs.getElementsByTagName('canvas'));
        if(outputs.length>0) {
            let zip = new JSZip();
            outputs.forEach((img, index)=>{
                const dataUrl = img.toDataURL("image/jpeg");
                const base64Data: string = dataUrl.split(",")[1];
                const byteCharacters: string = atob(base64Data);
                const byteNumbers: Uint8Array = new Uint8Array(byteCharacters.length);
                for (let k = 0; k < byteCharacters.length; k++) {
                    byteNumbers[k] = byteCharacters.charCodeAt(k);
                }
                const blob: Blob = new Blob([byteNumbers], { type: "image/jpeg" });
                zip.file(`${index}.jpg`, blob);
            });
            zip.generateAsync({ type: "blob" }).then((content: Blob) => {
                this.href_download.href = URL.createObjectURL(content);
                this.href_download.download = "creative_design_style_transfer.zip";
                this.href_download.click();
            }).catch((e:any)=>{
                this.log('Download err')
            }).finally(()=>{
                this.hide_mask();
            });
        }
    }

    uploadModels() {
        const _files = Array.from(this.upload_model.files);
        const files = _files.filter((file)=>{
            return REGSTYLE.test(file.webkitRelativePath)
        });
        const _json = files.find((file)=>{
            return REGJSON.test(file.name);
        });
        const _bin = files.filter((file)=>{
            return REGBIN.test(file.name);
        });
        if(_json && _bin.length>0) {
            this.show_mask();
            this.log('');
            _bin.unshift(_json);
            tf.loadGraphModel(tf.io.browserFiles(_bin)).then((m)=>{
                this.model = m;
                this.log('loaded model')
            }).catch((e)=>{
                this.log('Please select a right model');
            }).finally(()=>{
                this.hide_mask();
            })
        }
    }

    uploadImages(_files: FileList, con: HTMLElement) {
        let files = Array.from(_files).filter((file:any)=>{
            return file.type === 'image/jpeg';
        });
        let todo = files.length;
        if(todo>0) {
            con.innerHTML = '';
            this.show_mask();
            let callback=()=>{
                todo--;
                if(todo<=0) {
                     this.hide_mask();
                }
            };
            files.forEach((file)=>{
                this.readImage(file).then((url)=>{
                    let img = document.createElement('img');
                    img.src = url;
                    con.appendChild(img);
                }).finally(()=>{
                    callback()
                });
            });
        }
    }

    readImage(file:any):Promise<string> {
        return new Promise((resolve)=>{
          let reader = new FileReader();
          reader.onload = () => {
            resolve(reader.result as string);
          }
          reader.readAsDataURL(file);
        });
      }

    log(str:string) {
        this.el_info.innerHTML = str;
    }

    show_mask() {
        this.con_mask.style.display = '';
    }

    hide_mask() {
        this.con_mask.style.display = 'none';
    }
}

window.onload = ()=>{
   new App() 
}
