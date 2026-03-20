"use client";

import { useState, useEffect } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import MobileNavbar from "@/app/components/MobileNavbar";

const skills = [
  { name: "PHOTOSHOP", pct: 95, color: "#0288d1" },
  { name: "ILLUSTRATOR", pct: 85, color: "#f57c00" },
  { name: "INDESIGN", pct: 90, color: "#c2185b" },
  { name: "DREAMWEAVER", pct: 80, color: "#00c853" },
];

const teamMembers = [
  {
    img: "https://i.pravatar.cc/300?img=12",
    name: "ROBERT HAMILTON",
    role: "Web Developer",
    bio: "Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean sollicitudin, lorem quis bibendum auctor, est nisi elit ipsum, nec sagittis sem nibh id elit. Duis sed odio sit amet nibh vulputate cursus a sit amet mauris.",
    list: [
      "Lorem ipsum dolor sit proin.",
      "Proin gravida nibh nec sagittis.",
      "Aenean sollicitudin.",
      "Nec sagittis sem nibh id gravida.",
    ],
  },
  {
    img: "https://i.pravatar.cc/300?img=25",
    name: "WILLIS PEARSON",
    role: "Web Designer",
    bio: "Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean sollicitudin, lorem quis bibendum auctor, est nisi elit ipsum, nec sagittis sem nibh id elit. Duis sed odio sit amet nibh vulputate cursus a sit amet mauris.",
    list: [
      "Lorem ipsum dolor sit proin.",
      "Proin gravida nibh nec sagittis.",
      "Aenean sollicitudin.",
      "Nec sagittis sem nibh id gravida.",
    ],
  },
];

const testimonials = [
  {
    img: "https://i.pravatar.cc/80?img=8",
    text: "A designer is an emerging synthesis of artist, inventor, mechanic, objective economist and evolutionary strategist.",
    author: "AdelDima",
    role: "Web Developer",
    side: "left",
  },
  {
    img: "https://i.pravatar.cc/80?img=5",
    text: "A designer is an emerging synthesis of artist, inventor, mechanic, objective economist and evolutionary strategist.",
    author: "AdelDima",
    role: "Web Developer",
    side: "left",
  },
  {
    img: "https://i.pravatar.cc/80?img=9",
    text: "A designer is an emerging synthesis of artist, inventor, mechanic, objective economist and evolutionary strategist.",
    author: "AdelDima",
    role: "Web Developer",
    side: "right",
  },
  {
    img: "https://i.pravatar.cc/80?img=15",
    text: "A designer is an emerging synthesis of artist, inventor, mechanic, objective economist and evolutionary strategist.",
    author: "AdelDima",
    role: "Web Developer",
    side: "right",
  },
];

const slideImages = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80"
];

const socialIcons = [
  { icon: "fa-facebook", href: "#" },
  { icon: "fa-twitter", href: "#" },
  { icon: "fa-google-plus", href: "#" },
  { icon: "fa-dribbble", href: "#" },
];

import Image from "next/image";

export default function AboutUsPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hoveredMember, setHoveredMember] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Header />
      <MobileNavbar />

      <div className="dima-main">
        {/* ── HERO BANNER ── */}
        <section
          style={{
            position: "relative",
            width: "100%",
            height: "320px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/store/images/slides/shop-1.jpg"
            alt=""
            fill
            style={{
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(30, 28, 24, 0.62)",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              padding: "0 20px",
            }}
          >
            <h2
              style={{
                color: "#ffffff",
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "4px",
                margin: "0 0 16px 0",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              About Us
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: "60px",
                  height: "1px",
                  background: "#00cfc1",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#00cfc1",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: "60px",
                  height: "1px",
                  background: "#00cfc1",
                }}
              />
            </div>
          </div>
        </section>

        {/* ── SECTION 1 : Slider + Welcome + Skills ── */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <article role="article" style={{ marginBottom: "40px" }}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "420px",
                    overflow: "hidden",
                    background: "#111",
                  }}
                >
                  {slideImages.map((src, i) => (
                    <Image
                      key={i}
                      src={'https://okcredit-blog-images-prod.storage.googleapis.com/2021/04/ecommerce3-2.jpg'}
                      alt={`About slide ${i + 1}`}
                      fill
                      style={{
                        objectFit: "cover",
                        objectPosition: "center",
                        opacity: i === currentSlide ? 1 : 0,
                        transition: "opacity 1.2s ease",
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "16px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      gap: "8px",
                      zIndex: 10,
                    }}
                  >
                    {slideImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        aria-label={`Slide ${i + 1}`}
                        style={{
                          width: i === currentSlide ? "32px" : "12px",
                          height: "4px",
                          borderRadius: "2px",
                          border: "none",
                          background:
                            i === currentSlide
                              ? "#00cfc1"
                              : "rgba(255,255,255,0.5)",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </article>

              <div className="clear-section"></div>

              <div className="ok-row">
                {/* Left – Welcome text */}
                <div className="ok-md-5 ok-xsd-12">
                  <h4 className="uppercase">Welcome at our studio</h4>
                  <p>
                    Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet.
                    Aenean sollicitudin, lorem quis bibendum auctor, nisi elit
                    consequat ipsum, sagittis sem nibh id elit.{" "}
                    <a href="#">Duis sed</a> odio sit amet nibh vulputate cursus
                    amet mauris. Morbi accumsan ipsum velit. Nam nec tellus a
                    odio tincidunt auctor a ornare odio.
                  </p>
                  <div className="clear"></div>
                  <blockquote className="post-quote">
                    <p>
                      A designer is an emerging synthesis of artist, inventor,
                      mechanic, objective economist and evolutionary strategist.
                    </p>
                  </blockquote>
                </div>

                {/* Right – Skills */}
                <div className="ok-md-7 ok-xsd-12">
                  <h4 className="uppercase">Our Skills</h4>
                  <div className="clear"></div>
                  {skills.map((skill, idx) => (
                    <div
                      key={skill.name}
                      style={{
                        marginBottom: idx === skills.length - 1 ? 0 : "18px",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "10px",
                          background: "#e0e0e0",
                          borderRadius: "2px",
                          overflow: "hidden",
                          position: "relative",
                          marginBottom: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: `${skill.pct}%`,
                            height: "100%",
                            background: skill.color,
                            borderRadius: "2px",
                            transition: "width 1s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                          }}
                        >
                          <span
                            style={{
                              background: "#222",
                              color: "#fff",
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: "2px",
                              marginRight: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {skill.pct}%
                          </span>
                        </div>
                      </div>
                      <h6
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "1px",
                          color: "#444",
                        }}
                      >
                        {skill.name}
                      </h6>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2 : Our Team ── */}
        <section
          className="section section-colored"
          style={{ background: "#faf9f5" }}
        >
          <div className="page-section-content overflow-hidden">
            <div className="container">
              <h2 className="uppercase text-center">Our Team</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p className="text-center">
                Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean
                sollicitudin, lorem quis
                <br />
                bibendum auctor, est nisi elit ipsum, nec sagittis sem nibh id
                elit.
              </p>

              <div className="clear-section"></div>

              <div className="ok-row">
                {teamMembers.map((member, memberIdx) => (
                  <div key={member.name} className="ok-md-6 ok-xsd-12 ok-sd-12">
                    <div className="ok-row">
                      {/* Photo */}
                      <div className="ok-md-6 ok-xsd-12">
                        <div className="dima-team-member">
                          <div className="team-img">
                            {/* fix-chrome with position relative is the key fix */}
                            <div
                              className="fix-chrome"
                              style={{
                                position: "relative",
                                overflow: "hidden",
                              }}
                              onMouseEnter={() => setHoveredMember(memberIdx)}
                              onMouseLeave={() => setHoveredMember(null)}
                            >
                              <figure style={{ margin: 0, overflow: "hidden" }}>
                                <Image
                                  src={member.img}
                                  alt={member.name}
                                  width={300}
                                  height={300}
                                  style={{
                                    width: "100%",
                                    height: "auto",
                                    display: "block",
                                  }}
                                />
                              </figure>

                              {/* Overlay */}
                              <div
                                style={{
                                  position: "absolute",
                                  inset: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "rgba(0, 207, 193, 0.80)",
                                  opacity: hoveredMember === memberIdx ? 1 : 0,
                                  transition: "opacity 0.3s ease",
                                  zIndex: 2,
                                }}
                              >
                                <ul
                                  style={{
                                    padding: 0,
                                    margin: 0,
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, 50px)",
                                    gap: "16px",
                                    listStyle: "none",
                                  }}
                                >
                                  {socialIcons.map(({ icon, href }) => (
                                    <li key={icon}>
                                      <a
                                        href={href}
                                        style={{
                                          color: "#fff",
                                          fontSize: "18px",
                                          width: "50px",
                                          height: "50px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          border:
                                            "1px solid rgba(255,255,255,0.8)",
                                          textDecoration: "none",
                                        }}
                                      >
                                        <i className={"fa " + icon}></i>
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="ok-md-6 ok-xsd-12">
                        <h5>{member.name}</h5>
                        <h6 className="theme-color">{member.role}</h6>
                        <p>{member.bio}</p>
                        <div className="clear"></div>
                        <ul className="list-style check">
                          {member.list.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3 : Testimonials ── */}
        <section className="section">
          <div className="page-section-content overflow-hidden">
            <div className="container text-center">
              <h2 className="uppercase">What Others Say About Us</h2>
              <div className="topaz-line">
                <i className="di-separator"></i>
              </div>
              <p>
                Lorem Ipsum. Proin gravida nibh vel velit auctor aliquet. Aenean
                sollicitudin, lorem quis
                <br />
                bibendum auctor, est nisi elit ipsum, nec sagittis sem nibh id
                elit.
              </p>

              <div className="clear-section"></div>

              <div className="ok-row">
                {/* Left column */}
                <div className="ok-md-6 ok-xsd-12">
                  {testimonials
                    .filter((t) => t.side === "left")
                    .map((t, i) => (
                      <div
                        key={i}
                        className="dima-testimonial testimonial-side quote-text quote-start"
                      >
                        <div className="dima-testimonial-image">
                          <Image
                            src={t.img}
                            alt={t.author}
                            width={80}
                            height={80}
                          />
                        </div>
                        <blockquote>
                          <div className="quote-content">
                            <p>{t.text}</p>
                            <span className="dima-testimonial-meta">
                              <strong>{t.author}</strong>
                              <span>
                                <span> | </span>
                                {t.role}
                              </span>
                            </span>
                          </div>
                        </blockquote>
                      </div>
                    ))}
                </div>

                {/* Right column */}
                <div className="ok-md-6 ok-xsd-12">
                  {testimonials
                    .filter((t) => t.side === "right")
                    .map((t, i) => (
                      <div
                        key={i}
                        className="dima-testimonial testimonial-side quote-text quote-end"
                      >
                        <div className="dima-testimonial-image">
                          <Image
                            src={t.img}
                            alt={t.author}
                            width={80}
                            height={80}
                          />
                        </div>
                        <blockquote>
                          <div className="quote-content">
                            <p>{t.text}</p>
                            <span className="dima-testimonial-meta">
                              <strong>{t.author}</strong>
                              <span>
                                <span> | </span>
                                {t.role}
                              </span>
                            </span>
                          </div>
                        </blockquote>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
