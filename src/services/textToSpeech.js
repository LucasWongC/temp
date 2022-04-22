import config from '../config';
import fs from 'fs';
import util from 'util';
import TextToSpeech from '@google-cloud/text-to-speech';

export default async function convertTextToSpeech(
  ssml,
  filePath,
  voiceName = 'en-US-Wavenet-D',
  speed = 1
) {
  const client = new TextToSpeech.TextToSpeechClient();
  const request = {
    input: { ssml },
    voice: {
      languageCode: 'en-US',
      name: voiceName,
      ssmlGender: 'NEUTRAL',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: speed,
    },
  };

  const [response] = await client.synthesizeSpeech(request);
  const writeFile = util.promisify(fs.writeFile);

  await writeFile(filePath, response.audioContent, 'binary');
}

export function getGoogleSSML(message) {
  const patterns = [
    {
      regex: /{pause:([0-9\.]+)}/g,
      replace: '<break time="$1s"/>',
    },
  ];

  let ssml = message;
  patterns.forEach(pattern => {
    ssml = ssml.replace(pattern.regex, pattern.replace);
  });

  return `<speak>${ssml}</speak>`;
}
