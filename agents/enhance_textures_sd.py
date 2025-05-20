import os
import shutil
import torch
from PIL import Image
import numpy as np
from agents.base_agent import BaseAgent
from agents.agent_registry import register_agent
from realesrgan import RealESRGANer
from basicsr.archs.rrdbnet_arch import RRDBNet
import urllib.request
from agents.utils.asset_memory import AssetMemory
import json

# Required dependencies: realesrgan, torch, Pillow. Install with: pip install realesrgan torch Pillow
# A recommended model file is realesrgan-x4plus.pth. You can download it from the Real-ESRGAN GitHub releases page.

@register_agent("EnhanceTexturesSD Agent")
class EnhanceTexturesSD(BaseAgent):
    """
    An agent that enhances textures using Real-ESRGAN.
    """

    def __init__(self, config=None):
        super().__init__(config)
        # Initialize RealESRGANer model
        model_name = 'realesrgan-x4plus.pth'
        model_path = os.path.join(os.path.dirname(__file__), model_name)
        model_url = f'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/{model_name}'

        # Download model if not present
        if not os.path.exists(model_path):
            self.log(f"Downloading Real-ESRGAN model from {model_url}...")
            try:
                urllib.request.urlretrieve(model_url, model_path)
                self.log("Model downloaded successfully.")
            except Exception as e:
                self.log(f"Error downloading model: {e}", level="warning")
                self.log("EnhancementTexturesSD agent will not be able to function without the model.", level="warning")
                self.model = None
                return

        # Initialize RealESRGANer
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block_iter=6, num_grow_ch=32, scale=4)
        self.model = RealESRGANer(
            scale=4,
            model_path=model_path,
            dni_weight=None,
            model=model,
            tile=0,
            tile_pad=10,
            pre_pad=0,
            half=False,
            device='cuda' if torch.cuda.is_available() else 'cpu'
        )
        self.log(f"Real-ESRGAN model initialized on device: {self.model.device}")


    def run(self, input_folder: str, output_folder: str):
        """
        Enhances textures in the input folder using Real-ESRGAN.

        Args:
            input_folder: Path to the folder containing input textures.
            output_folder: Path to the folder to save enhanced textures.

        Returns:
            A list of dictionaries summarizing the enhancement results.
        """
        memory = AssetMemory("downloads/asset_memory.json")
        if not self.model:
            self.log("Model not loaded. Cannot run enhancement.", level="error")
            return []

        enhanced_files = []
        os.makedirs(output_folder, exist_ok=True)

        for filename in os.listdir(input_folder):
            input_path = os.path.join(input_folder, filename)
            output_path = os.path.join(output_folder, filename)

            if os.path.isfile(input_path) and filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                self.log(f"Processing {filename}...")
                try:
                    # Load image
                    img = Image.open(input_path).convert("RGB")
                    img = np.array(img)

                    # Upscale image
                    enhanced_img, _ = self.model.enhance(img)

                    # Save enhanced image
                    enhanced_img = Image.fromarray(enhanced_img)
                    enhanced_img.save(output_path)

                    self.log(f"Successfully enhanced and saved {filename}")
                    enhanced_files.append({
                        "original_filename": filename,
                        "enhanced_filepath": output_path,
                        "enhancement_status": "success",
                        "enhancement_method": "Real-ESRGAN"
                    })

                except Exception as e:
                    self.log(f"Error processing {filename}: {e}", level="error")
                    enhanced_files.append({
                        "original_filename": filename,
                        "enhanced_filepath": None, # Or output_path if a placeholder is desired
                        "enhancement_status": "failed",
                        "enhancement_method": "Real-ESRGAN"
                    })

        self.log(f"Enhancement complete. {len(enhanced_files)} files processed.")
        return enhanced_files
