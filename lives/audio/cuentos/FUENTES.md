# Voz de los cuentos

Generada localmente con Piper 1.8.0, modelo es_ES-davefx-medium.

Motor: https://github.com/OHF-Voice/piper1-gpl (GPL-3.0). El motor y los pesos no se distribuyen en la web: solo los audios generados.

Modelo y ficha: https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/davefx/medium

# Model card for davefx (medium)

* Language: es_ES (Spanish, Spain)
* Speakers: 1
* Quality: medium
* Samplerate: 22,050Hz

## Dataset

* URL: https://github.com/OHF-Voice/voice-datasets
* License: CC0

## Training

Finetuned from U.S. English lessac voice (medium quality).


Procesamiento: ritmo base 1.0, tono elevado un 10 %, ajuste de tiempo 0.96, mezcla de señal natural (48 %) con procesamiento espectral robótico (52 %), modulación de 70 Hz y filtro 140–4800 Hz. Referencia estética: ordenador clásico de ciencia ficción. No se ha usado una grabación de Joshua como fuente.

Los textos son los cuentos originales de este proyecto. No se utiliza ninguna API de síntesis ni clave comercial. Las descargas de MP3 sí cuentan como transferencia del alojamiento.
