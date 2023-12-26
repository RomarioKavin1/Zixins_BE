const router = require("express").Router();
const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

router.get("/hello", async (req, res) => {
  console.log("hello");
  res.status(200).json({ response: "hello v1" });
});

router.post("/image-pinata", async (req, res) => {
  const { image } = req.body;
  let data;
  let fetchUrl;
  let config;
  let imageBuffer;
  let formData;
  let blob;
  let response;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const supabase = SUPABASE_URL
    ? createClient(SUPABASE_URL, SUPABASE_KEY || "")
    : null;

  try {
    fetchUrl = JSON.stringify({
      imgUrl: image,
    });
    config = {
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

    try {
      imageBuffer = Buffer.from(data, "binary");

      fs.writeFileSync("./image.jpg", imageBuffer);

      formData = new FormData();
      formData.append("file", fs.createReadStream("./image.jpg"), {
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
    } catch (e) {
      res.status(200).json({ reason: "formdata formation error", error: e });
    }
    try {
      blob = new Blob([imageBuffer], { type: "image/jpeg" });
    } catch (e) {
      res.status(200).json({ reason: "blob formation error", error: e });
    }

    try {
      response = await axios.post(
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
    } catch (error) {
      res.status(200).json({ reason: "pinata error", error: error });
    }

    try {
      const { data, error } = supabase
        ? await supabase.storage
            .from("images")
            .upload(`${response.data.IpfsHash + ".png"}`, blob, {
              contentType: "image/png",
            })
        : { data: null, error: new Error("supabase not initialized") };
      if (error) {
        res
          .status(200)
          .json({ reason: "supabase returned error", error: error });
      } else {
        console.log("Supbase success");
      }
    } catch (e) {
      res.status(200).json({ reason: "supabase error", error: e });
    }

    res.status(200).json({
      image:
        "https://amber-accessible-porpoise-584.mypinata.cloud/ipfs/" +
        response.data.IpfsHash,
      imageAlt:
        SUPABASE_URL +
        "/storage/v1/object/public/images/" +
        response.data.IpfsHash +
        ".png",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ reson: "Weird error", error: error });
  }
});
router.post("/image", async (req, res) => {
  const { image } = req.body;
  let data;
  let fetchUrl;
  let config;
  let imageBuffer;
  let formData;
  let blob;
  let response;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const supabase = SUPABASE_URL
    ? createClient(SUPABASE_URL, SUPABASE_KEY || "")
    : null;
  try {
    fetchUrl = JSON.stringify({
      imgUrl: image,
    });
    config = {
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
    } catch (e) {
      res.status(200).json({ reason: "the next leg error", error: e });
    }

    try {
      imageBuffer = Buffer.from(data, "binary");

      fs.writeFileSync("./image.jpg", imageBuffer);

      formData = new FormData();
      formData.append("file", fs.createReadStream("./image.jpg"), {
        filename: "image.jpg",
      });
    } catch (e) {
      res.status(200).json({ reason: "formdata formation error", error: e });
    }
    try {
      blob = new Blob([imageBuffer], { type: "image/jpeg" });
    } catch (e) {
      res.status(200).json({ reason: "blob formation error", error: e });
    }

    try {
      response = await axios.post("https://api.nft.storage/upload", formData, {
        headers: {
          Authorization: `Bearer ${process.env.NFT_STORAGE_KEY}`,
          ...formData.getHeaders(),
        },
      });
    } catch (e) {
      res.status(200).json({ reason: "nft storage error", error: e });
    }

    try {
      const { data, error } = supabase
        ? await supabase.storage
            .from("images")
            .upload(`${response.data.value.cid + ".png"}`, blob, {
              contentType: "image/png",
            })
        : { data: null, error: new Error("supabase not initialized") };
      if (error) {
        res
          .status(200)
          .json({ reason: "supabase returned error", error: error });
      }
    } catch (e) {
      res.status(200).json({ reason: "supabase error", error: e });
    }

    res.status(200).json({
      image:
        "https://cloudflare-ipfs.com/ipfs/" +
        response.data.value.cid +
        "/image.jpg",
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
