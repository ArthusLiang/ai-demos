const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const tfjsConverter = require('@tensorflow/tfjs-converter');

const modelPath = 'file:/' + path.resolve(__dirname, 'assets/models/vgg-19/py/magenta_arbitrary-image-stylization-v1-256_2/saved_model.pb');
const outputPath = 'file:/' + path.resolve(__dirname, 'assets/models/vgg-19/js');

async function convertModel() {
    console.log("convert: ", modelPath)
    const graphModel = await tfjsConverter.loadGraphModel('https://tfhub.dev/google/magenta/arbitrary-image-stylization-v1-256/2');
    console.log("downloaded ")
    const layersModel = await tfjsConverter.convertGraphModel(graphModel);

    console.log("save: ", modelPath)
    await layersModel.save(outputPath);
    console.log('模型转换完成！');
}

convertModel().catch(err => {
  console.error('模型转换出错：', err);
});