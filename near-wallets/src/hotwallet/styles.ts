export const styles = /* css */ `
body,
html {
  margin: 0;
  padding: 0;
  background: transparent;
  background: #1d1f20;
  width: 100%;
  height: 100%;
}

a {
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 22px;
  text-decoration-line: underline;
  color: #fd84e3;
}

@supports (font-variation-settings: normal) {
  :root {
    font-family: InterVariable, sans-serif;
  }
}

*::-webkit-scrollbar {
  display: none;
}

* {
  box-sizing: border-box;
  --Stroke: #c7bab8;
  --Elevation-0: #f3ebea;
  --Elevation-1: #ebdedc;
  --Elevation-2: #d9cdcb;
  --Black-Primary: #2c3034;
  --Black-Secondary: #6b6661;
  font-family: "Inter" -apple-system BlinkMacSystemFont "Segoe UI" "Roboto" "Oxygen" "Ubuntu" "Cantarell" "Fira Sans" "Droid Sans"
    "Helvetica Neue" sans-serif;
  -webkit-tap-highlight-color: transparent;
  -webkit-tap-highlight-color: transparent;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.logo {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 10px;
  margin: 0 auto;
  margin-bottom: 16px;
  margin-top: auto;
}

.popup {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: var(--surface-common-default, #1d1f20);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 24px;
}

.title {
  color: var(--text-primary, #ebdedc);
  font-feature-settings: "liga" off;
  font-family: "Cabinet Grotesk";
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
  line-height: normal;
  margin: 0;
}
.title span {
  color: var(--text-orange, #e9c363);
  font-feature-settings: "liga" off;
  font-family: "Cabinet Grotesk";
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
  line-height: normal;
}

.qr-code {
  background: url("https://hot-labs.org/hot-widget/qr.svg");
  background-size: cover;
  background-position: 0 -14px;
  width: 280px;
  height: 280px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.qr-code canvas {
  position: absolute;
  top: 70px;
  left: 70px;
}

.divider {
  color: var(--text-secondary, #ada5a4);
  font-family: Inter;
  font-size: 18px;
  font-style: normal;
  font-weight: 700;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 16px;
  margin-top: -8px;
}
.divider::before,
.divider::after {
  height: 1px;
  background: var(--border-lowest, rgba(255, 255, 255, 0.07));
  content: "";
  display: block;
  flex: 1;
}

.button {
  display: flex;
  padding: 12px 16px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  border-radius: 16px;
  border: 1px solid var(--border-high, rgba(255, 255, 255, 0.25));
  background: var(--controls-teriary-3, #ffedb2);
  box-shadow: 4px 4px 0px 0px var(--controls-primary-dark-dark, #2c3034),
    5px 5px 0px 0px var(--controls-shadow-stroke, #3d3f46);
  color: var(--text-dark-dark, #2c3034);
  text-align: center;
  font-feature-settings: "liga" off, "calt" off;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
  ouline: none;
}

.button.simple {
  background: var(--text-primary, #ebdedc);
  border: 1px solid var(--text-primary, #ebdedc);
  color: var(--text-dark-dark, #2c3034);
  border-radius: 12px;
  box-shadow: none;
}

.button.simple.reverse {
  background: transparent;
  color: var(--text-primary, #ebdedc);
}

.get-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--surface-common-container--low, #262729);
  cursor: pointer;
  width: 100%;
  text-decoration: none;
  margin-top: auto;
}

.get-button-text {
  font-size: 14px;
  font-weight: 400 !important;
  line-height: 18px;
  margin: 0;
}

.get-button-green {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 10px;
  gap: 4px;
  border-radius: 99px;
  border: 1px solid var(--text-green, #77c7bd);
  color: var(--text-green, #77c7bd);
}

.h4 {
  font-family: "Cabinet Grotesk";
  font-style: normal;
  font-weight: 800;
  font-size: 20px;
  line-height: 25px;
  color: #2c3034;
  margin: 0;
}

.close-button {
  position: absolute;
  top: 32px;
  right: 32px;
  height: 32px;
  width: 32px;
  padding: 0;
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  color: #2c3034;
  border: none;
  margin: 0;
  outline: none;
  cursor: pointer;
  height: 32px;
  background: var(--surface-common-container--low, #262729);
  border-radius: 50px;
  justify-content: center;
  align-items: center;
  display: flex;
  cursor: pointer;
  transition: 0.2s opacity;
}
.close-button:hover {
  opacity: 0.7;
}
@media (max-width: 640px) {
  .close-button {
    right: 16px;
    top: 16px;
  }
}

.text {
  color: var(--text-secondary, #ada5a4);
  text-align: center;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
  margin: 0;
}

.text.description {
  margin-top: 6px;
  color: var(--text-primary, #ebdedc);
  font-weight: 400;
}

.text a {
  color: var(--text-blue, #6385ff);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: 20px;
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
`;
