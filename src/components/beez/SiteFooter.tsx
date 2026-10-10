import { APP_URL, CONTACT_EMAIL } from "./links";

export default function SiteFooter() {
  return (
    <footer>
      <div className="fc">
        <div>
          <h4>Beez</h4>
          <a href="#/">Home</a>
          <a href="#/vision">Our vision</a>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#/offer">What we offer</a>
          <a className="launch" href={APP_URL} rel="noopener noreferrer">
            Launch app
          </a>
          <a href="#/features">Features</a>
          <a href="#/faq">FAQ</a>
        </div>
        <div>
          <h4>More</h4>
          <a href="#/problem">The challenge</a>
          <a href="#/faq">Mombasa, Kenya</a>
        </div>
      </div>
      <span>© {new Date().getFullYear()} Beez. Smart tools. Real growth.</span>
      <a id="contact" href={`mailto:${CONTACT_EMAIL}`}>
        Contact us
      </a>
    </footer>
  );
}
