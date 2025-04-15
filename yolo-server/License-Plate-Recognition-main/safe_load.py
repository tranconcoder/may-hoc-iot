import torch
import sys
import os
from torch.serialization import add_safe_globals

# Add the model classes to the safe globals list
from yolov5.models.yolo import Model
add_safe_globals([Model])

# Now modify the lp_image.py script to load models properly
if __name__ == "__main__":
    # Import and execute the lp_image script
    import argparse
    from PIL import Image
    import cv2
    import math 
    import function.utils_rotate as utils_rotate
    from IPython.display import display
    import time
    import function.helper as helper

    ap = argparse.ArgumentParser()
    ap.add_argument('-i', '--image', required=True, help='path to input image')
    args = ap.parse_args()

    # Load models with weights_only=False since we trust the source
    yolo_LP_detect = torch.hub.load('yolov5', 'custom', path='model/LP_detector.pt', 
                                    source='local', trust_repo=True, 
                                    _legacy_weights_only=False)
    
    yolo_license_plate = torch.hub.load('yolov5', 'custom', path='model/LP_ocr.pt', 
                                        source='local', trust_repo=True,
                                        _legacy_weights_only=False)
    
    yolo_license_plate.conf = 0.60

    img = cv2.imread(args.image)
    plates = yolo_LP_detect(img, size=640)

    list_plates = plates.pandas().xyxy[0].values.tolist()
    list_read_plates = set()
    if len(list_plates) == 0:
        lp = helper.read_plate(yolo_license_plate,img)
        if lp != "unknown":
            cv2.putText(img, lp, (7, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
            list_read_plates.add(lp)
    else:
        for plate in list_plates:
            flag = 0
            x = int(plate[0]) # xmin
            y = int(plate[1]) # ymin
            w = int(plate[2] - plate[0]) # xmax - xmin
            h = int(plate[3] - plate[1]) # ymax - ymin  
            crop_img = img[y:y+h, x:x+w]
            cv2.rectangle(img, (int(plate[0]),int(plate[1])), (int(plate[2]),int(plate[3])), color = (0,0,225), thickness = 2)
            cv2.imwrite("crop.jpg", crop_img)
            rc_image = cv2.imread("crop.jpg")
            lp = ""
            for cc in range(0,2):
                for ct in range(0,2):
                    lp = helper.read_plate(yolo_license_plate, utils_rotate.deskew(crop_img, cc, ct))
                    if lp != "unknown":
                        list_read_plates.add(lp)
                        cv2.putText(img, lp, (int(plate[0]), int(plate[1]-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
                        flag = 1
                        break
                if flag == 1:
                    break
    cv2.imshow('frame', img)
    cv2.waitKey()
    cv2.destroyAllWindows()
