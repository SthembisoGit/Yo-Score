import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';

interface Props {
  userId: string;
  userName: string;
  totalScore: number;
}

export const GenerateQRCode: React.FC<Props> = ({ userId, userName, totalScore }) => {
  const [copied, setCopied] = React.useState(false);
  const shareUrl = `${window.location.origin}/profile/public/${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Profile link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('talent-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `YoScore-Credential-${userName.replace(/\s+/g, '-')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2 bg-primary hover:bg-primary/90">
          <Share2 className="h-4 w-4" />
          Share Talent Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Portable Talent Credential</DialogTitle>
          <DialogDescription>
            Share this QR code with recruiters to prove your verified skills and skip initial screening.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-6 py-6">
          <div className="p-4 bg-white rounded-2xl shadow-inner border-8 border-primary/5">
            <QRCodeSVG
              id="talent-qr-code"
              value={shareUrl}
              size={200}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: "/favicon.ico",
                x: undefined,
                y: undefined,
                height: 40,
                width: 40,
                excavate: true,
              }}
            />
          </div>
          
          <div className="text-center">
            <p className="text-lg font-bold">{userName}</p>
            <p className="text-sm text-muted-foreground">Verified YoScore: {totalScore}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <Button variant="outline" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
            <Button variant="outline" onClick={downloadQRCode} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
        <div className="bg-muted/30 p-3 rounded-lg border border-border">
          <p className="text-[11px] text-center text-muted-foreground leading-tight">
            Recruiters scan this code to see your "Accessibility-Aware" performance data without 
            needing a verbal phone screen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
