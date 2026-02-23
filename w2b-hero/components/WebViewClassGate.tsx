'use client';

import { useEffect } from 'react';

function detectInAppWebView(): boolean {
  const ua = navigator.userAgent || '';

  const isInstagram = /\bInstagram\b/i.test(ua);
  const isFacebookInApp = /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua);
  const isAndroidWebView = /\bwv\b/i.test(ua);
  const isIosWebView =
    /(iPhone|iPad|iPod)/i.test(ua) &&
    /AppleWebKit/i.test(ua) &&
    !/Safari/i.test(ua);

  return isInstagram || isFacebookInApp || isAndroidWebView || isIosWebView;
}

export default function WebViewClassGate() {
  useEffect(() => {
    if (!detectInAppWebView()) return;

    document.documentElement.classList.add('wv-inapp');
    document.body.classList.add('wv-inapp');

    return () => {
      document.documentElement.classList.remove('wv-inapp');
      document.body.classList.remove('wv-inapp');
    };
  }, []);

  return null;
}
