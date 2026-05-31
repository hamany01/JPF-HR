/**
 * نظام JPF-HR - مولد كلمات المرور الآمنة
 * 
 * يحتوي الملف على دوال لتوليد كلمات مرور قوية وعشوائية تناسب الاستخدام الإداري،
 * وتدعم التوليد الآمن العشوائي باللغة الإنجليزية أو بالنمط العربي المقروء المطور.
 */

/**
 * توليد كلمة مرور عشوائية قوية وآمنة (طول 12 خانة مع أحرف كبيرة وصغيرة وأرقام ورموز)
 */
export const generateSecurePassword = (): string => {
  const length = 12;
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=";
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = "";
  
  // ضمان ارتقاء كلمة المرور لجميع شروط القوة (حرف كبير، حرف صغير، رقم، رمز خاص)
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = 4; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length);
    password += allChars[randomIndex];
  }
  
  // خلط أحرف الكلمة لضمان العشوائية التامة
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * توليد كلمة مرور بنمط عربي سهل الحفظ والقراءة مع رمز خاص وأرقام عشوائية
 * مثال: قويأسد4829@
 */
export const generateArabicReadablePassword = (): string => {
  const adjectives = ['سريع', 'قوي', 'ذكي', 'نشط', 'أمين', 'مبهر', 'عادل', 'سند', 'بارع', 'كريم'];
  const nouns = ['نمر', 'صقر', 'أسد', 'نسر', 'فهد', 'فرس', 'سيف', 'درع', 'شاهين', 'جبل'];
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}${noun}${randomNum}@`;
};
