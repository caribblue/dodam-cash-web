import "./globals.css";

export const metadata = {
  title: "도담캐시 - 학원 맞춤형 장부",
  description: "도담플래너 연동 학원 통합 장부 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      {/* <body> 태그에 아래 속성을 추가해 줍니다 */}
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}