import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface JpfLogoProps {
  className?: string;
}

export default function JpfLogo({ className = 'h-12' }: JpfLogoProps) {
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    // محاولة قراءة اللوجو المخصص من localStorage لتسريع التحميل الأولي
    return localStorage.getItem('jpf_custom_logo') || '/logo.png';
  });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // جلب اللوجو المحدث من Firestore لضمان التزامن
    const fetchCustomLogo = async () => {
      try {
        const docRef = doc(db, 'settings', 'appearance');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.logoBase64) {
            setLogoSrc(data.logoBase64);
            localStorage.setItem('jpf_custom_logo', data.logoBase64);
            setImgError(false);
          } else {
            // إذا تم مسح اللوجو المخصص من الإعدادات
            if (localStorage.getItem('jpf_custom_logo')) {
              localStorage.removeItem('jpf_custom_logo');
              setLogoSrc('/logo.png');
            }
          }
        }
      } catch (error) {
        console.error("Error fetching custom logo from firestore:", error);
      }
    };

    fetchCustomLogo();
  }, []);

  const handleImageError = () => {
    if (logoSrc !== '/logo.png') {
      // إذا فشل اللوجو المخصص، جرب اللوجو الافتراضي
      setLogoSrc('/logo.png');
    } else {
      // إذا فشل اللوجو الافتراضي أيضاً، سنظهر شعاراً نصياً رائعاً واحترافياً
      setImgError(true);
    }
  };

  if (imgError) {
    // تصميم شعار بديل فائق الجمال والاحترافية عند عدم العثور على أي صورة لوجو
    return (
      <div className={`flex items-center gap-2 select-none px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white font-extrabold shadow-sm ${className}`}>
        <div className="w-8 h-8 rounded-lg bg-white text-indigo-700 flex items-center justify-center text-sm font-black shadow-inner">
          JPF
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black leading-tight tracking-wide">نظام الشؤون القانونية</p>
          <p className="text-[8px] font-medium text-slate-100 opacity-90 leading-tight">مصنع جدة للدهانات</p>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={logoSrc} 
      alt="Logo" 
      className={className} 
      onError={handleImageError}
      referrerPolicy="no-referrer"
    />
  );
}
