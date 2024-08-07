/* eslint-disable @next/next/no-img-element */
export default function SplashScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="flex flex-col items-center">
        <img src="splash.png" alt="Splash Image" />
        <div>Moo Tools ......</div>
      </div>
    </div>
  );
}
