// Deterministic synthetic test pixels only; no source image, personal information or network input.
import {deflateSync, inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const width=64, height=40;
const crc32=bytes=>{let crc=0xffffffff;for(const value of bytes){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
const chunk=(kind,data)=>{const type=Buffer.from(kind),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([size,type,data,crc]);};
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const rows=Buffer.alloc(height*(width*4+1));
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=y*(width*4+1)+1+x*4,accent=x<4||y<4||x>=width-4||y>=height-4;rows[p]=accent?235:0;rows[p+1]=accent?250:150;rows[p+2]=accent?247:136;rows[p+3]=255;}
const compressed=deflateSync(rows);assert.deepEqual(inflateSync(compressed),rows);
export const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',Buffer.alloc(0))]);
export const base64=png.toString('base64'), sha256=createHash('sha256').update(png).digest('hex');
