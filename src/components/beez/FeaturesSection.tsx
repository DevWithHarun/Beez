import { useState } from "react";

export default function FeaturesSection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
<section id={"features"} className={"features-page"}>
  {"\n"}
  <header className={"section-heading features-heading"}>
    <h2>{"Everything a street vendor needs to sell."}</h2>
    <p>{"Eight features, one simple flow, from the first product to the final delivery. Tap a step to see how it works."}</p>
  </header>
  {"\n"}
  <div className={"tabs"} role={"tablist"}>
    <button className={"tab"} role={"tab"} id={"tab0"} aria-controls={"tp0"} aria-selected={activeTab === 0} onClick={() => setActiveTab(0)} type="button">{"1. Shop page"}</button>
    <button className={"tab"} role={"tab"} id={"tab1"} aria-controls={"tp1"} aria-selected={activeTab === 1} onClick={() => setActiveTab(1)} type="button">{"2. Voice products"}</button>
    <button className={"tab"} role={"tab"} id={"tab2"} aria-controls={"tp2"} aria-selected={activeTab === 2} onClick={() => setActiveTab(2)} type="button">{"3. Shop video"}</button>
    <button className={"tab"} role={"tab"} id={"tab3"} aria-controls={"tp3"} aria-selected={activeTab === 3} onClick={() => setActiveTab(3)} type="button">{"4. Ordering"}</button>
    <button className={"tab"} role={"tab"} id={"tab4"} aria-controls={"tp4"} aria-selected={activeTab === 4} onClick={() => setActiveTab(4)} type="button">{"5. M-Pesa"}</button>
    <button className={"tab"} role={"tab"} id={"tab5"} aria-controls={"tp5"} aria-selected={activeTab === 5} onClick={() => setActiveTab(5)} type="button">{"6. Alerts"}</button>
    <button className={"tab"} role={"tab"} id={"tab6"} aria-controls={"tp6"} aria-selected={activeTab === 6} onClick={() => setActiveTab(6)} type="button">{"7. Delivery"}</button>
    <button className={"tab"} role={"tab"} id={"tab7"} aria-controls={"tp7"} aria-selected={activeTab === 7} onClick={() => setActiveTab(7)} type="button">{"8. Records"}</button>
  </div>
  {"\n"}
  <div className={"tp"} role={"tabpanel"} id={"tp0"} aria-labelledby={"tab0"} hidden={activeTab !== 0}>
    <div>
      <h3>{"Your shop page in minutes"}</h3>
      <p>{"Sign up with your phone number and get a shop page of your own, with a link you can share anywhere."}</p>
      <ul className={"ck"}>
        <li>{"Login with a phone number and a text-message code"}</li>
        <li>{"Shop name, category, short description and location"}</li>
        <li>{"A shareable link customers can open on any phone"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Shop page with a share link"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <rect className={"py"} x={"55"} y={"28"} width={"110"} height={"30"} rx={"8"}></rect>
        <text className={"st"} x={"66"} y={"48"}>{"Beez"}</text>
        <circle className={"pg"} cx={"110"} cy={"84"} r={"14"}></circle>
        <rect className={"pg"} x={"80"} y={"106"} width={"60"} height={"7"} rx={"3"}></rect>
        <rect className={"pg"} x={"90"} y={"118"} width={"40"} height={"6"} rx={"3"}></rect>
        <rect className={"pw"} x={"64"} y={"136"} width={"92"} height={"22"} rx={"11"}></rect>
        <text className={"sm"} x={"110"} y={"150"} textAnchor={"middle"}>{"Share your link"}</text>
        <rect className={"pi"} x={"80"} y={"195"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"80"} y={"204"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"98"} y={"195"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"98"} y={"204"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"107"} y={"195"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"107"} y={"204"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"125"} y={"195"} width={"7"} height={"7"}></rect>
        <rect className={"pi"} x={"125"} y={"204"} width={"7"} height={"7"}></rect>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp1"} aria-labelledby={"tab1"} hidden={activeTab !== 1}>
    <div>
      <h3>{"Add products by voice"}</h3>
      <p>{"Just say what you sell and what it costs. Beez turns your words into a product list, with no forms to fill in. Prefer to type? You can do that too."}</p>
      <ul className={"ck"}>
        <li>{"Speak in English or Swahili, for example \"dresses 1,500, jeans 2,000\""}</li>
        <li>{"Review what Beez understood and fix it before it goes live"}</li>
        <li>{"Add or edit products by hand any time"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Voice product list to confirm"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <circle className={"py"} cx={"110"} cy={"58"} r={"20"}></circle>
        <rect className={"pi"} x={"106"} y={"48"} width={"8"} height={"14"} rx={"4"}></rect>
        <rect className={"pi"} x={"97"} y={"68"} width={"26"} height={"2"}></rect>
        <rect className={"py"} x={"78"} y={"92"} width={"5"} height={"8"} rx={"2"}></rect>
        <rect className={"py"} x={"88"} y={"88"} width={"5"} height={"16"} rx={"2"}></rect>
        <rect className={"py"} x={"98"} y={"84"} width={"5"} height={"24"} rx={"2"}></rect>
        <rect className={"py"} x={"108"} y={"89"} width={"5"} height={"14"} rx={"2"}></rect>
        <rect className={"py"} x={"118"} y={"86"} width={"5"} height={"20"} rx={"2"}></rect>
        <rect className={"py"} x={"128"} y={"91"} width={"5"} height={"10"} rx={"2"}></rect>
        <rect className={"py"} x={"138"} y={"93"} width={"5"} height={"6"} rx={"2"}></rect>
        <rect className={"pw"} x={"62"} y={"116"} width={"96"} height={"22"} rx={"6"}></rect>
        <text className={"sm"} x={"70"} y={"131"}>{"Dress"}</text>
        <text className={"st"} x={"150"} y={"131"} textAnchor={"end"}>{"1,500"}</text>
        <rect className={"pw"} x={"62"} y={"144"} width={"96"} height={"22"} rx={"6"}></rect>
        <text className={"sm"} x={"70"} y={"159"}>{"Jeans"}</text>
        <text className={"st"} x={"150"} y={"159"} textAnchor={"end"}>{"2,000"}</text>
        <rect className={"pw"} x={"62"} y={"172"} width={"96"} height={"22"} rx={"6"}></rect>
        <text className={"sm"} x={"70"} y={"187"}>{"Shirt"}</text>
        <text className={"st"} x={"150"} y={"187"} textAnchor={"end"}>{"1,000"}</text>
        <rect className={"py"} x={"72"} y={"214"} width={"76"} height={"24"} rx={"12"}></rect>
        <text className={"st"} x={"110"} y={"230"} textAnchor={"middle"}>{"Confirm"}</text>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp2"} aria-labelledby={"tab2"} hidden={activeTab !== 2}>
    <div>
      <h3>{"A short video of your shop"}</h3>
      <p>{"Let customers see who you are. Record one 15 to 30 second video of your shop, stall or products."}</p>
      <ul className={"ck"}>
        <li>{"Recorded right inside the app"}</li>
        <li>{"Compressed to save your customers' mobile data"}</li>
        <li>{"Optional photos for each product"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Short shop video"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <rect className={"pg"} x={"58"} y={"32"} width={"104"} height={"124"} rx={"10"}></rect>
        <circle className={"py"} cx={"110"} cy={"94"} r={"18"}></circle>
        <path className={"pi"} d={"M104 84 L121 94 L104 104 Z"}></path>
        <rect className={"pw"} x={"62"} y={"168"} width={"96"} height={"6"} rx={"3"}></rect>
        <rect className={"py"} x={"62"} y={"168"} width={"42"} height={"6"} rx={"3"}></rect>
        <text className={"sm"} x={"62"} y={"192"}>{"0:15 shop intro"}</text>
        <rect className={"pg"} x={"62"} y={"208"} width={"28"} height={"28"} rx={"6"}></rect>
        <rect className={"pg"} x={"96"} y={"208"} width={"28"} height={"28"} rx={"6"}></rect>
        <rect className={"pg"} x={"130"} y={"208"} width={"28"} height={"28"} rx={"6"}></rect>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp3"} aria-labelledby={"tab3"} hidden={activeTab !== 3}>
    <div>
      <h3>{"Customers order without an app"}</h3>
      <p>{"Customers open your link, browse your products and place an order. Nothing to download and no account to create."}</p>
      <ul className={"ck"}>
        <li>{"Product list and video on one simple page"}</li>
        <li>{"Pick items, enter name and phone number"}</li>
        <li>{"Drop a pin on the map and add a landmark for delivery"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Customer ordering page"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <rect className={"pw"} x={"58"} y={"32"} width={"50"} height={"58"} rx={"8"}></rect>
        <circle className={"pg"} cx={"83"} cy={"54"} r={"12"}></circle>
        <rect className={"py"} x={"66"} y={"72"} width={"34"} height={"12"} rx={"6"}></rect>
        <rect className={"pw"} x={"112"} y={"32"} width={"50"} height={"58"} rx={"8"}></rect>
        <circle className={"pg"} cx={"137"} cy={"54"} r={"12"}></circle>
        <rect className={"py"} x={"120"} y={"72"} width={"34"} height={"12"} rx={"6"}></rect>
        <rect className={"pw"} x={"58"} y={"98"} width={"50"} height={"58"} rx={"8"}></rect>
        <circle className={"pg"} cx={"83"} cy={"120"} r={"12"}></circle>
        <rect className={"py"} x={"66"} y={"138"} width={"34"} height={"12"} rx={"6"}></rect>
        <rect className={"pw"} x={"112"} y={"98"} width={"50"} height={"58"} rx={"8"}></rect>
        <circle className={"pg"} cx={"137"} cy={"120"} r={"12"}></circle>
        <rect className={"py"} x={"120"} y={"138"} width={"34"} height={"12"} rx={"6"}></rect>
        <rect className={"py"} x={"66"} y={"176"} width={"88"} height={"24"} rx={"12"}></rect>
        <text className={"st"} x={"110"} y={"192"} textAnchor={"middle"}>{"Order"}</text>
        <path className={"pl"} d={"M110 232 v-14 M110 236 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0"}></path>
        <text className={"sm"} x={"110"} y={"256"} textAnchor={"middle"}>{"Pin + landmark"}</text>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp4"} aria-labelledby={"tab4"} hidden={activeTab !== 4}>
    <div>
      <h3>{"Pay with M-Pesa"}</h3>
      <p>{"The customer approves the payment on their own phone. An order counts only once the payment is confirmed."}</p>
      <ul className={"ck"}>
        <li>{"A payment request goes straight to the customer's phone"}</li>
        <li>{"Prices and totals are calculated securely by Beez"}</li>
        <li>{"Every payment is recorded and can be traced"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"M-Pesa payment confirmed"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <circle className={"py"} cx={"110"} cy={"76"} r={"26"}></circle>
        <path className={"pl"} d={"M98 76 l8 8 16-18"}></path>
        <text className={"sm"} x={"110"} y={"128"} textAnchor={"middle"}>{"Payment success"}</text>
        <text className={"st"} x={"110"} y={"150"} textAnchor={"middle"}>{"KES 600"}</text>
        <rect className={"pw"} x={"64"} y={"166"} width={"92"} height={"26"} rx={"8"}></rect>
        <text className={"sm"} x={"110"} y={"183"} textAnchor={"middle"}>{"Paid with M-Pesa"}</text>
        <rect className={"py"} x={"72"} y={"214"} width={"76"} height={"24"} rx={"12"}></rect>
        <text className={"st"} x={"110"} y={"230"} textAnchor={"middle"}>{"Done"}</text>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp5"} aria-labelledby={"tab5"} hidden={activeTab !== 5}>
    <div>
      <h3>{"Instant order alerts"}</h3>
      <p>{"The moment a paid order arrives, you know about it, even when the app is closed."}</p>
      <ul className={"ck"}>
        <li>{"Push notification with the order details"}</li>
        <li>{"Text message backup if you have not seen it"}</li>
        <li>{"Accept the order or mark it ready in one tap"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Order alerts"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <rect className={"pw"} x={"58"} y={"36"} width={"104"} height={"44"} rx={"10"}></rect>
        <circle className={"py"} cx={"74"} cy={"58"} r={"8"}></circle>
        <rect className={"pg"} x={"90"} y={"50"} width={"62"} height={"7"} rx={"3"}></rect>
        <rect className={"pg"} x={"90"} y={"62"} width={"42"} height={"6"} rx={"3"}></rect>
        <rect className={"pw"} x={"58"} y={"90"} width={"104"} height={"44"} rx={"10"}></rect>
        <circle className={"py"} cx={"74"} cy={"112"} r={"8"}></circle>
        <rect className={"pg"} x={"90"} y={"104"} width={"62"} height={"7"} rx={"3"}></rect>
        <rect className={"pg"} x={"90"} y={"116"} width={"42"} height={"6"} rx={"3"}></rect>
        <rect className={"pw"} x={"58"} y={"144"} width={"104"} height={"44"} rx={"10"}></rect>
        <circle className={"py"} cx={"74"} cy={"166"} r={"8"}></circle>
        <rect className={"pg"} x={"90"} y={"158"} width={"62"} height={"7"} rx={"3"}></rect>
        <rect className={"pg"} x={"90"} y={"170"} width={"42"} height={"6"} rx={"3"}></rect>
        <rect className={"py"} x={"72"} y={"206"} width={"76"} height={"24"} rx={"12"}></rect>
        <text className={"st"} x={"110"} y={"222"} textAnchor={"middle"}>{"Ready"}</text>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp6"} aria-labelledby={"tab6"} hidden={activeTab !== 6}>
    <div>
      <h3>{"Delivery by local riders"}</h3>
      <p>{"Nearby riders get the job, pick up from you and bring the order to the customer's pin."}</p>
      <ul className={"ck"}>
        <li>{"Approved riders switch themselves on when they are free"}</li>
        <li>{"The first rider to accept takes the job"}</li>
        <li>{"A 4-digit delivery code confirms the right person got the order"}</li>
        <li>{"Customers can follow their order's status"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Delivery route and code"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <rect className={"pg"} x={"58"} y={"32"} width={"104"} height={"120"} rx={"10"}></rect>
        <path className={"pl"} d={"M72 138 L72 110 L110 110 L110 70 L146 70"}></path>
        <circle className={"py"} cx={"72"} cy={"138"} r={"6"}></circle>
        <circle className={"pi"} cx={"146"} cy={"70"} r={"6"}></circle>
        <rect className={"pw"} x={"58"} y={"164"} width={"104"} height={"60"} rx={"10"}></rect>
        <text className={"sm"} x={"110"} y={"182"} textAnchor={"middle"}>{"Delivery code"}</text>
        <rect className={"pg"} x={"64"} y={"190"} width={"20"} height={"24"} rx={"5"}></rect>
        <text className={"st"} x={"74"} y={"207"} textAnchor={"middle"}>{"4"}</text>
        <rect className={"pg"} x={"88"} y={"190"} width={"20"} height={"24"} rx={"5"}></rect>
        <text className={"st"} x={"98"} y={"207"} textAnchor={"middle"}>{"7"}</text>
        <rect className={"pg"} x={"112"} y={"190"} width={"20"} height={"24"} rx={"5"}></rect>
        <text className={"st"} x={"122"} y={"207"} textAnchor={"middle"}>{"2"}</text>
        <rect className={"pg"} x={"136"} y={"190"} width={"20"} height={"24"} rx={"5"}></rect>
        <text className={"st"} x={"146"} y={"207"} textAnchor={"middle"}>{"9"}</text>
      </svg>
    </div>
  </div>
  <div className={"tp"} role={"tabpanel"} id={"tp7"} aria-labelledby={"tab7"} hidden={activeTab !== 7}>
    <div>
      <h3>{"A verified record of every sale"}</h3>
      <p>{"Every order, payment and delivery is saved. For the first time, your business has a history you can prove."}</p>
      <ul className={"ck"}>
        <li>{"See what sold and what you earned"}</li>
        <li>{"Builds the trust record that can lead to fair credit"}</li>
      </ul>
    </div>
    <div className={"pimg"}>
      <svg viewBox={"0 0 220 300"} role={"img"} aria-label={"Sales record"}>
        <rect className={"pf"} x={"45"} y={"8"} width={"130"} height={"284"} rx={"20"}></rect>
        <rect className={"pg"} x={"88"} y={"14"} width={"44"} height={"6"} rx={"3"}></rect>
        <rect className={"pw"} x={"58"} y={"32"} width={"104"} height={"96"} rx={"10"}></rect>
        <rect className={"py"} x={"70"} y={"96"} width={"12"} height={"20"} rx={"3"}></rect>
        <rect className={"py"} x={"88"} y={"82"} width={"12"} height={"34"} rx={"3"}></rect>
        <rect className={"py"} x={"106"} y={"88"} width={"12"} height={"28"} rx={"3"}></rect>
        <rect className={"py"} x={"124"} y={"64"} width={"12"} height={"52"} rx={"3"}></rect>
        <rect className={"py"} x={"142"} y={"76"} width={"12"} height={"40"} rx={"3"}></rect>
        <rect className={"pw"} x={"58"} y={"142"} width={"104"} height={"24"} rx={"8"}></rect>
        <text className={"sm"} x={"66"} y={"158"}>{"Orders today"}</text>
        <text className={"st"} x={"154"} y={"158"} textAnchor={"end"}>{"12"}</text>
        <rect className={"pw"} x={"58"} y={"172"} width={"104"} height={"24"} rx={"8"}></rect>
        <text className={"sm"} x={"66"} y={"188"}>{"Paid"}</text>
        <text className={"st"} x={"154"} y={"188"} textAnchor={"end"}>{"KES 7,800"}</text>
        <rect className={"pw"} x={"58"} y={"202"} width={"104"} height={"24"} rx={"8"}></rect>
        <text className={"sm"} x={"66"} y={"218"}>{"Delivered"}</text>
        <text className={"st"} x={"154"} y={"218"} textAnchor={"end"}>{"11"}</text>
      </svg>
    </div>
  </div>
  {"\n"}
</section>
  );
}
