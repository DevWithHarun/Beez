import { APP_URL, CONTACT_EMAIL } from "./links";
import { Facebook, Linkedin, Mail, Youtube } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="fc">
        <div className="fbrand">
          <a className="flogo" href="#/" aria-label="Beez home">
            <img src="/beez-logo.png" alt="Beez" aria-hidden="true" />
            <span>Beez</span>
          </a>
          <p>Smart tools. Real growth.</p>
          <p>Mombasa, Kenya</p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
        <nav aria-label="Explore">
          <h4>Explore</h4>
          <a href="#/">Home</a>
          <a href="#/vision">Our vision</a>
          <a href="#/problem">The challenge</a>
        </nav>
        <nav aria-label="Product">
          <h4>Product</h4>
          <a href="#/offer">What we offer</a>
          <a href="#/features">Features</a>
          <a href="#/faq">FAQ</a>
          <a className="launch" href={APP_URL} rel="noopener noreferrer">
            Launch app
          </a>
        </nav>
        <div className="flegal">
          <h4>Legal &amp; Contact</h4>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          <a className="femail" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
      <div className="fbottom">
        <span>© {new Date().getFullYear()} Beez. All rights reserved.</span>
        <div className="fbottom-actions">
          <a id="contact" href={`mailto:${CONTACT_EMAIL}`}>
            Contact us <Mail aria-hidden="true" />
          </a>
          <div className="fsocial" role="group" aria-label="Social channels">
            <span title="LinkedIn"><Linkedin aria-hidden="true" /></span>
            <span title="Facebook"><Facebook aria-hidden="true" /></span>
            <span title="YouTube"><Youtube aria-hidden="true" /></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
