const router = require("express").Router();
const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_KEY || "")
  : null;

const uploadImageToBucket = async (image, name) => {
  const { data, error } = supabase
    ? await supabase.storage.from("images").upload(`${name}.png`, image, {
        contentType: "image/png",
      })
    : { data: null, error: new Error("supabase not initialized") };
};

router.get("/hello", async (req, res) => {
  console.log("hello");
  res.status(200).json({ response: "hello v1" });
});

router.post("/image-pinata", async (req, res) => {
  const { image } = req.body;
  let data;

  try {
    let fetchUrl = JSON.stringify({
      imgUrl: image,
    });
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.thenextleg.io/getImage",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MIDJOURNEY_API_KEY}`,
      },
      responseType: "arraybuffer",
      data: fetchUrl,
    };
    try {
      data = (await axios.request(config)).data;
    } catch (error) {
      res.status(200).json({ reason: "the next leg error", error: error });
    }

    const imageBuffer = Buffer.from(data, "binary");

    const tempFilePath = "./image.jpg";
    fs.writeFileSync(tempFilePath, imageBuffer);

    const formData = new FormData();
    formData.append("file", fs.createReadStream(tempFilePath), {
      filename: "image.jpg",
    });
    const pinataMetadata = JSON.stringify({
      name: "ZexCraft NFT",
    });
    formData.append("pinataMetadata", pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 0,
    });
    formData.append("pinataOptions", pinataOptions);

    try {
      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          maxBodyLength: "Infinity",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
            Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
          },
        }
      );
      const blob = new Blob([imageBuffer], { type: "image/jpeg" });
      uploadImageToBucket(blob, response.data.IpfsHash + ".png");

      res.status(200).json({
        image: response.data.IpfsHash,
        imageAlt:
          SUPABASE_URL +
          "/storage/v1/object/public/images/" +
          response.data.IpfsHash +
          ".png",
      });
    } catch (error) {
      res.status(200).json({ reason: "pinata error", error: error });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ reson: "Weird error", error: error });
  }
});
router.post("/image", async (req, res) => {
  const { image } = req.body;

  try {
    let fetchUrl = JSON.stringify({
      imgUrl: image,
    });
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.thenextleg.io/getImage",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MIDJOURNEY_API_KEY}`,
      },
      responseType: "arraybuffer",
      data: fetchUrl,
    };

    const { data } = await axios.request(config);
    const imageBuffer = Buffer.from(data, "binary");

    const tempFilePath = "./image.jpg";
    fs.writeFileSync(tempFilePath, imageBuffer);
    // // Create FormData
    const formData = new FormData();
    formData.append("file", fs.createReadStream(tempFilePath), {
      filename: "image.jpg",
    });

    const response = await axios.post(
      "https://api.nft.storage/upload",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    const blob = new Blob([imageBuffer], { type: "image/jpeg" });
    uploadImageToBucket(blob, response.data.value.cid);

    res.status(200).json({
      image: response.data.value.cid,
      imageAlt:
        SUPABASE_URL +
        "/storage/v1/object/public/images/" +
        response.data.value.cid +
        ".png",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error", message: error });
  }
});

module.exports = router;
