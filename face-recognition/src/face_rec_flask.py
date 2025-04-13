from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
import subprocess
from flask import Flask
from flask import render_template , request
from flask_cors import CORS, cross_origin
import tensorflow as tf
import argparse
import facenet
import os
import sys
import math
import pickle
import align.detect_face
import numpy as np
import cv2
import collections
from sklearn.svm import SVC
import base64
import warnings
warnings.simplefilter("ignore", DeprecationWarning)

MINSIZE = 20
THRESHOLD = [0.2, 0.3, 0.3]
FACTOR = 0.709
IMAGE_SIZE = 182
INPUT_IMAGE_SIZE = 160
CLASSIFIER_PATH = 'Models/facemodel.pkl'
FACENET_MODEL_PATH = 'Models/model.pb'

# Load The Custom Classifier
with open(CLASSIFIER_PATH, 'rb') as file:
    model, class_names = pickle.load(file)
print("Custom Classifier, Successfully loaded")

tf.Graph().as_default()

# Cai dat GPU neu co
gpu_options = tf.compat.v1.GPUOptions(per_process_gpu_memory_fraction=0.6)
sess = tf.compat.v1.Session(config=tf.compat.v1.ConfigProto(gpu_options=gpu_options, log_device_placement=False))

# Load the model
print('Loading feature extraction model')
facenet.load_model(FACENET_MODEL_PATH)

# Get input and output tensors
images_placeholder = tf.compat.v1.get_default_graph().get_tensor_by_name("input:0")
embeddings = tf.compat.v1.get_default_graph().get_tensor_by_name("embeddings:0")
phase_train_placeholder = tf.compat.v1.get_default_graph().get_tensor_by_name("phase_train:0")
embedding_size = embeddings.get_shape()[1]
pnet, rnet, onet = align.detect_face.create_mtcnn(sess, "src/align")

app = Flask(__name__)
CORS(app)

# Khai báo biến toàn cục để lưu trữ số lượng hình ảnh cho mỗi nhãn
image_count = {}

@app.route('/')
@cross_origin()
def index():
    return "OK!"

@app.route("/add", methods=["POST"])
@cross_origin()
def add_user():
    global image_count  # Sử dụng biến toàn cục
    if request.method != "POST":
        return "Method not allowed", 405
    
    files = request.files.getlist('hinhanh')  # Lấy danh sách các tệp hình ảnh
    label = request.form.get('ten')  # Lấy nhãn từ form
    if len(files) < 5 or not label :
        return "No images or label provided", 400
    

    save_path = f'Dataset/FaceData/raw/{label}'  # Đường dẫn để lưu hình ảnh
    os.makedirs(save_path, exist_ok=True)  # Tạo thư mục nếu chưa tồn tại

    for file in files:
        filename = file.filename
        file.save(os.path.join(save_path, filename))  # Lưu tệp hình ảnh
        print(filename)


    # Chạy một file Python khác
    print(subprocess.Popen("python src/align_dataset_mtcnn.py  Dataset/FaceData/raw Dataset/FaceData/processed --image_size 160 --margin 32  --random_order --gpu_memory_fraction 0.25", shell=True, stdout=subprocess.PIPE).stdout.read())
    print(subprocess.Popen("python src/classifier.py TRAIN Dataset/FaceData/processed Models/model.pb Models/facemodel.pkl --batch_size 1000", shell=True, stdout=subprocess.PIPE).stdout.read())
        
    return "Success", 200

@app.route('/recog', methods=['POST'])
@cross_origin()
def upload_img_file():
    if request.method == 'POST':
        name="Unknown"
        f = request.form.get('image')

        decoded_string = base64.b64decode(f)
        frame = np.fromstring(decoded_string, dtype=np.uint8)
        frame = cv2.imdecode(frame, cv2.IMREAD_ANYCOLOR)

        bounding_boxes, _ = align.detect_face.detect_face(frame, MINSIZE, pnet, rnet, onet, THRESHOLD, FACTOR)

        faces_found = bounding_boxes.shape[0]

        if faces_found > 0:
            det = bounding_boxes[:, 0:4]
            bb = np.zeros((faces_found, 4), dtype=np.int32)
            for i in range(faces_found):
                bb[i][0] = det[i][0]
                bb[i][1] = det[i][1]
                bb[i][2] = det[i][2]
                bb[i][3] = det[i][3]
                cropped = frame
                scaled = cv2.resize(cropped, (INPUT_IMAGE_SIZE, INPUT_IMAGE_SIZE),
                                    interpolation=cv2.INTER_CUBIC)
                scaled = facenet.prewhiten(scaled)
                scaled_reshape = scaled.reshape(-1, INPUT_IMAGE_SIZE, INPUT_IMAGE_SIZE, 3)
                feed_dict = {images_placeholder: scaled_reshape, phase_train_placeholder: False}
                emb_array = sess.run(embeddings, feed_dict=feed_dict)
                predictions = model.predict_proba(emb_array)
                best_class_indices = np.argmax(predictions, axis=1)
                best_class_probabilities = predictions[
                    np.arange(len(best_class_indices)), best_class_indices]
                best_name = class_names[best_class_indices[0]]
                print("Name: {}, Probability: {}".format(best_name, best_class_probabilities))

                if best_class_probabilities > 0.5:
                    name = class_names[best_class_indices[0]]
                else:
                    name = "Unknown"


        return name


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0',port='5001')


