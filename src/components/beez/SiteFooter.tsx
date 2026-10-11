import { APP_URL, CONTACT_EMAIL } from "./links";
import { Facebook, Linkedin, Mail, Youtube } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer>
      <div className="fc">
        <div className="fbrand">
          <a className="flogo" href="#/" aria-label="Beez home">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 8c-7 0-12 6-12 14 0 9 6 15 12 18 6-3 12-9 12-18 0-8-5-14-12-14Z" />
              <path d="M13 18h22M12 25h24M15 32h18" />
              <path d="M19 8c0-4 3-6 5-6s5 2 5 6" />
              <path d="m11 13-5-4m31 4 5-4M9 21H4m40 0h-5" />
            </svg>
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
