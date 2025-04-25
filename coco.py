import fiftyone as fo
import fiftyone.zoo as foz

#
# Only the required images will be downloaded (if necessary).
# By default, only detections are loaded
#

dataset = foz.load_zoo_dataset(
    "coco-2017",
    splits=["validation","train"],
    classes=['car', 'truck', 'bus', 'motorcycle', 'bicycle'],
    # max_samples=50,
)

# Visualize the dataset in the FiftyOne App
session = fo.launch_app(dataset)