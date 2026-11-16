/** Theme is always inherited from the operating system; old saved overrides are ignored. */
export function mountThemeControls():void {
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 function apply(){
  const theme=media.matches?'dark':'light';
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  window.dispatchEvent(new CustomEvent('podcut:themechange',{detail:{theme}}));
 }
 apply();
 media.addEventListener('change',apply);
}
