const express = require('express');
const env = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const fs = require("fs");
const OPENAI = require('openai');
const app = express();
env.config();
app.use(cors());
app.use(express.json());

const { createClient } = require("@deepgram/sdk");

const { get } = require('http');



const deepgram = createClient(process.env.API_KEY);
const transcribeFile = async (file) => {
  // STEP 1: Create a Deepgram client using the API key
  

  // STEP 2: Call the transcribeFile method with the audio payload and options
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    // path to the audio file
    file,
    // STEP 3: Configure Deepgram options for audio analysis
    {
      model: "nova-2",
      smart_format: true,
    }
  );
  


  if (error) throw error;
  // STEP 4: Print the results
  if (!error) return result.results.channels[0].alternatives[0].transcript;
};



const getAudio = async (transtext) => {
  // STEP 2: Make a request and configure the request with options (such as model choice, audio configuration, etc.)

  const response = await deepgram.speak.request(
    { text :transtext},
    {
      model: "aura-asteria-en",
      encoding: "linear16",
      container: "wav",
    }
  );
  // STEP 3: Get the audio stream and headers from the response
  const stream = await response.getStream();
  const headers = await response.getHeaders();
  if (stream) {
    // STEP 4: Convert the stream to an audio buffer
    const buffer = await getAudioBuffer(stream);
    // STEP 5: Write the audio buffer to a file
    fs.writeFile("output.wav", buffer, (err) => {
      if (err) {
        console.error("Error writing audio to file:", err);
      } else {
        console.log("Audio file written to output.wav");
      }

    });
    return buffer;
  } else {
    console.error("Error generating audio:", stream);
  }

  if (headers) {
    console.log("Headers:", headers);
  }
};

// helper function to convert stream to audio buffer
const getAudioBuffer = async (response) => {
  const reader = response.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
  }

  const dataArray = chunks.reduce(
    (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
    new Uint8Array(0)
  );

  return Buffer.from(dataArray.buffer);
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });



const getAnswer = async (api_key, question) => {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: question }],
        max_tokens: 150,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api_key}`,
        },
      }
    );
    console.log("Response:", response.data.choices[0].message.content.trim());
  }catch(error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
  }
};


app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  try {
    const {openapi_key} = req.query
    console.log(openapi_key, "in server")
    const text = await transcribeFile(req.file.buffer);
    console.log(text);
    let ans = await getAnswer(openapi_key, text);
    if (!ans) {
      ans = "Invalid API key";
    }
    const audioData = await getAudio(ans);

    const audiofile = await getAudio(ans);
    res.json({ result: ans , audio: audiofile.toString("base64"),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});



app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
