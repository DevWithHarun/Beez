import { APP_URL } from "./links";

const tabs = [
  { label: "Discover", href: "/discover", icon: "/icons/discover.png" },
  { label: "Track", href: "/track", icon: "/icons/track.png" },
  { label: "Sell", href: APP_URL, icon: "/icons/sell.png" },
  { label: "Delivery", href: APP_URL, icon: "/icons/delivery.png" },
];

export default function MobileTabBar() {
  return (
    <nav className="mobile-tab-bar" aria-label="App sections">
      {tabs.map(({ label, href, icon }) => (
        <a className="mobile-tab" href={href} key={label}>
          <img className="mobile-tab-icon" src={icon} alt="" aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
