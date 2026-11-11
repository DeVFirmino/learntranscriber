// Copied from src/renderer/pcm-worklet.js so the replacement UI can load an
// AudioWorklet from its own origin. The original file is unchanged.
// Provenance: LearnTranscriber renderer PCM recorder, preserved behavior.
class PCMRecorder extends AudioWorkletProcessor {
  // The capture may ask for smaller blocks (echo reduction does), also while recording; otherwise blocks are 4096
  // samples. A new size takes effect after the samples already held are posted.
  constructor(options) {
    super();
    const sized=size=>new Int16Array(Number.isInteger(size)&&size>=128&&size<=16384?size:4096);
    this.samples=sized(options?.processorOptions?.blockSize);this.length=0;this.active=true;
    this.port.onmessage=event=>{
      if(event.data.type==='pause') {this.paused=event.data.paused===true;this.length=0;}
      else if(event.data.type==='block') {this.flush();this.samples=sized(event.data.size);}
      else if(event.data.type==='flush') {
        if(event.data.stop)this.active=false;
        this.flush();this.port.postMessage({type:'flushed',id:event.data.id});
      }
    };
  }
  flush() {
    if(!this.length)return;
    const buffer=this.samples.slice(0,this.length).buffer;
    this.port.postMessage({type:'samples',buffer},[buffer]);this.length=0;
  }
  process(inputs) {
    const channels=inputs[0];
    if(!this.active||this.paused||!channels.length)return true;
    for(let i=0;i<channels[0].length;i++) {
      let value=0;for(const channel of channels)value+=channel[i]/channels.length;
      value=Math.max(-1,Math.min(1,value));
      this.samples[this.length++]=Math.round(value*(value<0?32768:32767));
      if(this.length===this.samples.length)this.flush();
    }
    return true;
  }
}
registerProcessor('pcm-recorder',PCMRecorder);
