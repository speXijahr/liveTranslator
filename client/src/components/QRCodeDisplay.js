// client/src/components/QRCodeDisplay.js
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

function QRCodeDisplay({ roomId }) {
  if (!roomId) return null;

  const joinUrl = `${window.location.origin}/?roomId=${roomId}`;

  return (
    <div className="qr-code-display">
      <h3>Share Room ID: <code>{roomId}</code></h3>
      <p>Scan QR code or share the link to invite viewers:</p>
      <QRCodeSVG value={joinUrl} size={128} level="H" includeMargin={true} />
      <p><a href={joinUrl} target="_blank" rel="noopener noreferrer">{joinUrl}</a></p>
    </div>
  );
}

export default QRCodeDisplay;