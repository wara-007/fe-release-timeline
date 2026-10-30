'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="error-screen"><h1>ยังอ่าน Timeline ไม่สำเร็จ</h1><p>กรุณาตรวจการเชื่อมต่อหรือสิทธิ์อ่าน Google Sheet แล้วลองใหม่</p><button className="primary-button" onClick={reset}>ลองอีกครั้ง</button></main>;
}
