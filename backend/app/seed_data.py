"""Initial website content, written only from VGLUG's official information
(the organisation brief and https://vglug.org/).

Seeding never overwrites existing rows, so administrator edits are always preserved.
Pages are created as drafts so an administrator can review them before publication.
"""

ORG_NAME = "Viluppuram GNU/Linux Users Group"

TELEGRAM_URL = "https://t.me/vpmglug"
MAILING_LIST_URL = "https://groups.google.com/forum/#!forum/viluppuramglug/join"

AWARDS = [
    {
        "title": "Achievers Award",
        "subtitle": "2021",
        "body_md": "Presented by the Honourable Chief Minister of Tamil Nadu, M. K. Stalin.",
    },
    {
        "title": "Young Social Change Maker Award",
        "subtitle": "2020",
        "body_md": "Presented by Trust for Youth and Child Leadership.",
    },
    {
        "title": "Nambikkai Viruthu",
        "subtitle": "2020",
        "body_md": "Awarded by Vikatan Publication.",
    },
]

INITIATIVES = [
    {
        "title": "Software Freedom Day",
        "subtitle": "Worldwide celebration",
        "body_md": "Part of a worldwide event that creates awareness about the importance and benefits of "
        "Free and Open Source Software.",
    },
    {
        "title": "100 Villages 100 GLUGs",
        "subtitle": "Rural outreach",
        "body_md": "An initiative to establish 100 GNU/Linux Users Groups in 100 villages, promoting awareness of "
        "cybercrime, digital safety and Free and Open Source Software in rural communities.",
    },
    {
        "title": "Tech Training",
        "subtitle": "Weekend meetups",
        "body_md": "Weekend technology meetups that give rural youth and students the chance to build technical "
        "skills and improve their employability through FOSS technologies.",
    },
    {
        "title": "Workshops and Community Meetups",
        "subtitle": "Learn together",
        "body_md": "Regular gatherings that encourage learning, collaboration, technical discussion, coding and "
        "contributions to open-source projects.",
    },
    {
        "title": "Summer and Winter Camps",
        "subtitle": "Learning programmes",
        "body_md": "Programmes that introduce students and young people to technology, programming, GNU/Linux and "
        "open-source software.",
    },
    {
        "title": "Weekathon",
        "subtitle": "Build and contribute",
        "body_md": "A community-driven technical activity that encourages practical learning, coding, collaboration "
        "and technology contributions.",
    },
]

EXHIBITION_TOPICS = """Since 2013, VGLUG has organised **annual FOSS exhibitions** for the general public, creating awareness about:

- Virtual privacy
- Malware awareness
- Internet surveillance
- Cybersecurity
- Free and Open Source Software
- Digital rights and freedom"""

# Programme blocks shown in the alternating "What we do" layout on the home page.
PROGRAMMES = [
    {
        "title": "Tech Training for rural youth",
        "subtitle": "Weekend meetups",
        "body_md": "Open weekend technology meetups equip rural youth with coding and analytical skills using Free "
        "and Open Source Software. Through these activities VGLUG has equipped **more than 1,000 young minds** "
        "with technology knowledge and skills.",
        "url": "/meetups",
    },
    {
        "title": "100 Villages 100 GLUGs",
        "subtitle": "Rural outreach",
        "body_md": "Establishing GNU/Linux Users Groups in 100 villages to bring FOSS technologies to rural "
        "communities and raise awareness of cybercrime and digital safety.",
        "url": "/about#initiatives",
    },
    {
        "title": "Annual FOSS exhibition",
        "subtitle": "Every year since 2013",
        "body_md": "A public exhibition on virtual privacy, malware, internet surveillance, cybersecurity, Free and "
        "Open Source Software, and digital rights and freedom.",
        "url": "/events",
    },
    {
        "title": "Software Freedom Day, camps and Weekathon",
        "subtitle": "Community events",
        "body_md": "Software Freedom Day, Education Freedom Day, summer and winter camps, workshops and Weekathon "
        "bring people together to learn, build and contribute.",
        "url": "/events",
    },
]

CONTRIBUTIONS = [
    {
        "title": "Sangailakkiyam",
        "subtitle": "Android app",
        "body_md": "An Android app for reading Sangam-era Tamil literature.",
    },
    {
        "title": "Spell4Wiki",
        "subtitle": "Wikipedia audio",
        "body_md": "Helps people record pronunciations of words for Wikipedia, and also works as a wiki dictionary.",
    },
    {
        "title": "VizhiTamilApp",
        "subtitle": "Accessibility",
        "body_md": "Helps visually impaired users listen to Tamil books using image-to-text technology.",
    },
    {
        "title": "Dr. RavikumarMP App",
        "subtitle": "Civic technology",
        "body_md": "Connects the Villupuram Member of Parliament with constituents for suggestions and complaints.",
    },
    {
        "title": "Tamil localisation",
        "subtitle": "Translation",
        "body_md": "Tamil translations for free software including Mozilla, Tusky, NewPipe, VLC, Wikipedia, SeraX, "
        "Common Voice, Watomatic and TrebleShot.",
    },
]

CAMPUS_GLUGS = [
    {"title": "UCEV GLUG", "subtitle": "Campus GLUG", "body_md": "", "url": "https://glugucev.wordpress.com"},
    {"title": "IFET GLUG", "subtitle": "Campus GLUG", "body_md": "", "url": "https://ifetglug.wordpress.com"},
    {"title": "MAILAM GLUG", "subtitle": "Campus GLUG", "body_md": "", "url": ""},
]

PAGES = {
    "home": {
        "title": "Technology and knowledge should reach everyone.",
        "eyebrow": "VGLUG Foundation · Since 2013",
        "intro_md": (
            "The Viluppuram GNU/Linux Users Group is a non-profit Free and Open Source Software community. Since "
            "2013 we have worked to take free software and its ideals — freedom, sharing and equal access — to every "
            "corner of the country, from developed communities to underprivileged sections of society."
        ),
        "cta_label": "Join the community",
        "cta_url": "/join",
        "sections": [
            {
                "anchor": "impact",
                "layout": "stats",
                "heading": "Our impact",
                "items": [
                    {"title": "2013", "subtitle": "Year VGLUG was started", "body_md": ""},
                    {"title": "1,000+", "subtitle": "Young minds equipped with technology knowledge and skills", "body_md": ""},
                    {"title": "100 × 100", "subtitle": "Our goal: 100 GNU/Linux Users Groups in 100 villages", "body_md": ""},
                ],
            },
            {
                "anchor": "what-is-vglug",
                "layout": "prose",
                "heading": "What is VGLUG?",
                "body_md": (
                    "VGLUG is a social movement and a volunteer-run community. We create awareness about free "
                    "software and liberating knowledge, and promote its use in villages, schools, colleges, "
                    "academic research and industry. We believe technology should not be restricted to a few "
                    "people — technology, knowledge and digital freedom should reach everyone.\n\n"
                    "> **Our vision:** a movement that aims to bring science and economic development to all "
                    "sections of society through the essence of free software.\n>\n"
                    "> **Our mission:** to bring the concept of free software to all people across the country and "
                    "encourage the adoption, use and improvement of free software in industry and academia.\n\n"
                    "[Learn more about us](/about)"
                ),
            },
            {"anchor": "campus-glugs", "layout": "links", "heading": "Our campus GLUGs", "items": CAMPUS_GLUGS},
            {"anchor": "what-we-do", "layout": "features", "heading": "What we do", "items": PROGRAMMES},
            {
                "anchor": "contributions",
                "layout": "cards",
                "heading": "Our contributions to FOSS and society",
                "items": CONTRIBUTIONS,
            },
            {"anchor": "recognitions", "layout": "awards", "heading": "Recognitions", "items": AWARDS},
        ],
    },
    "about": {
        "title": "About VGLUG",
        "eyebrow": "Our story",
        "intro_md": (
            f"The **{ORG_NAME} (VGLUG)** is a non-profit organisation started in 2013, inspired by the worldwide "
            "Free and Open Source Software movement. We are a technical and philosophical community that believes "
            "technology should not be restricted to a few people — technology, knowledge and digital freedom "
            "should reach everyone."
        ),
        "cta_label": "",
        "cta_url": "",
        "sections": [
            {
                "anchor": "history",
                "layout": "prose",
                "heading": "Who we are",
                "body_md": (
                    "VGLUG is a social movement that works to enlighten people about the importance of free "
                    "software and liberating knowledge. Our main objective is to take free software and its "
                    "ideological principles to every corner of the country, from developed communities to "
                    "underprivileged sections of society.\n\n"
                    "We create awareness among computer users about free software and promote its implementation "
                    "and use in villages, schools, higher education institutions, academic research and industrial "
                    "research.\n\n"
                    "VGLUG is run by a group of volunteers from Viluppuram who work together to promote Free "
                    "Software and technology education."
                ),
            },
            {
                "anchor": "vision-mission",
                "layout": "cards",
                "heading": "Vision and mission",
                "items": [
                    {
                        "title": "Vision",
                        "subtitle": "",
                        "body_md": "A movement that aims to bring science and economic development to all sections "
                        "of society through the essence of free software.",
                    },
                    {
                        "title": "Mission",
                        "subtitle": "",
                        "body_md": "To bring the concept of free software to all people across the country and "
                        "encourage the adoption, use and improvement of free software in industry and academia.",
                    },
                ],
            },
            {
                "anchor": "objectives",
                "layout": "list",
                "heading": "Aims and objectives",
                "items": [
                    {"title": "Awareness", "subtitle": "", "body_md": "Creating awareness about GNU/Linux operating systems and Free Software."},
                    {"title": "Free distributions", "subtitle": "", "body_md": "Providing various GNU/Linux distributions — the latest and older versions — free of cost to people in need around Viluppuram."},
                    {"title": "Open meetups", "subtitle": "", "body_md": "Conducting weekly or twice-monthly meetups in Viluppuram for anyone interested in GNU/Linux and Free Software. Everyone is welcome to participate."},
                    {"title": "Community activities", "subtitle": "", "body_md": "Organising workshops, Software Freedom Day, Education Freedom Day, summer camps, winter camps, Weekathon and other community activities."},
                    {"title": "Digital freedom", "subtitle": "", "body_md": "Promoting digital freedom, free knowledge, privacy and freedom of expression on the internet."},
                    {"title": "Giving back", "subtitle": "", "body_md": "Encouraging people to contribute to society through technology and open-source communities."},
                ],
            },
            {
                "anchor": "what-we-do",
                "layout": "prose",
                "heading": "What we do",
                "body_md": (
                    "We conduct open weekend technology meetups to equip rural youth with coding and analytical "
                    "skills using FOSS technologies. Through these activities VGLUG has equipped **more than 1,000 "
                    "young minds** with technology knowledge and skills — building scientific understanding, logical "
                    "thinking, problem-solving abilities and confidence.\n\n"
                    "Through our **100 Villages 100 GLUGs** initiative, we work to bring FOSS technologies to rural "
                    "communities.\n\n" + EXHIBITION_TOPICS
                ),
            },
            {"anchor": "initiatives", "layout": "cards", "heading": "Major initiatives and activities", "items": INITIATIVES},
            {"anchor": "contributions", "layout": "cards", "heading": "Contributions to FOSS and society", "items": CONTRIBUTIONS},
            {"anchor": "campus-glugs", "layout": "links", "heading": "Campus GLUGs", "items": CAMPUS_GLUGS},
            {
                "anchor": "philosophy",
                "layout": "list",
                "heading": "Our philosophy",
                "body_md": (
                    "VGLUG is both a technical and a philosophical group. Society provides the opportunities and "
                    "resources people need to live, sustain and grow — so contributing knowledge and skills back "
                    "to society is an important responsibility. We believe in:"
                ),
                "items": [
                    {"title": "Software freedom and user freedom", "subtitle": "", "body_md": ""},
                    {"title": "Freedom of knowledge and learning", "subtitle": "", "body_md": ""},
                    {"title": "Freedom of speech and expression on the internet", "subtitle": "", "body_md": ""},
                    {"title": "Equal access to technology", "subtitle": "", "body_md": ""},
                    {"title": "Community participation and social responsibility", "subtitle": "", "body_md": ""},
                    {"title": "Sharing knowledge rather than restricting it", "subtitle": "", "body_md": ""},
                    {"title": "Encouraging contributions to society", "subtitle": "", "body_md": ""},
                ],
            },
            {"anchor": "recognitions", "layout": "awards", "heading": "Recognitions and awards", "items": AWARDS},
        ],
    },
    "join": {
        "title": "Join the VGLUG community",
        "eyebrow": "Get involved",
        "intro_md": (
            "VGLUG is run by volunteers and grows through the people who take part. Students, professionals and "
            "free software contributors all meet, learn and build together. **Everyone is welcome to participate.**"
        ),
        "cta_label": "Join our Telegram group",
        "cta_url": TELEGRAM_URL,
        "sections": [
            {
                "anchor": "who-can-join",
                "layout": "prose",
                "heading": "Who can join",
                "body_md": (
                    "Our meetups are open to everyone interested in GNU/Linux and Free Software. You do not need "
                    "to be an expert — VGLUG's weekend meetups exist precisely to help students and rural youth "
                    "build their skills from the ground up."
                ),
            },
            {
                "anchor": "opportunities",
                "layout": "cards",
                "heading": "Ways to participate",
                "items": [
                    {"title": "Attend a meetup", "subtitle": "Weekly or twice a month", "body_md": "Technical sessions and discussions for students, professionals and free software contributors. [See upcoming meetups](/meetups)."},
                    {"title": "Learn at Tech Training", "subtitle": "Weekends", "body_md": "Develop practical technical skills with FOSS technologies at our weekend technology meetups."},
                    {"title": "Take part in events", "subtitle": "Workshops, camps and more", "body_md": "Participate in Software Freedom Day, Education Freedom Day, summer and winter camps and Weekathon. [See events](/events)."},
                    {"title": "Volunteer", "subtitle": "Help run the community", "body_md": "VGLUG is run by volunteers. Help organise meetups, exhibitions and outreach activities."},
                    {"title": "Contribute to free software", "subtitle": "Code, translation, Wikipedia", "body_md": "Join community projects such as Tamil localisation of free software, Spell4Wiki and our apps."},
                    {"title": "Start or join a campus GLUG", "subtitle": "100 Villages 100 GLUGs", "body_md": "Help bring awareness of free software, digital safety and digital rights to colleges and villages."},
                ],
            },
            {
                "anchor": "benefits",
                "layout": "list",
                "heading": "What you gain",
                "items": [
                    {"title": "Hands-on GNU/Linux and FOSS skills", "subtitle": "", "body_md": "Learn by doing, alongside people who share what they know."},
                    {"title": "Logical thinking and problem solving", "subtitle": "", "body_md": "Coding activities build scientific understanding and confidence."},
                    {"title": "A community of learners", "subtitle": "", "body_md": "Collaborate, discuss technology and grow together."},
                    {"title": "A way to give back", "subtitle": "", "body_md": "Use your knowledge and skills to contribute to society."},
                ],
            },
            {
                "anchor": "how-to-join",
                "layout": "prose",
                "heading": "How to join",
                "body_md": (
                    f"1. **Join the conversation.** Join our [Telegram group]({TELEGRAM_URL}) or subscribe to the "
                    f"[VGLUG mailing list]({MAILING_LIST_URL}).\n"
                    "2. **Find a session.** Check the [Meetups](/meetups) and [Events](/events) pages for upcoming "
                    "activities.\n"
                    "3. **Come along.** Meetups are open — just turn up and introduce yourself.\n"
                    "4. **Stay updated.** Subscribe to email updates at the bottom of any page."
                ),
            },
            {
                "anchor": "contact",
                "layout": "callout",
                "heading": "Questions?",
                "body_md": "Call the coordinator or reach us on social media — see our [Contact page](/contact).",
            },
        ],
    },
    "contact": {
        "title": "Contact us",
        "eyebrow": "Get in touch",
        "intro_md": (
            "We would love to hear from you — whether you want to attend a meetup, volunteer, learn more about "
            "free software or support VGLUG's work."
        ),
        "cta_label": "",
        "cta_url": "",
        "sections": [
            {
                "anchor": "community-channels",
                "layout": "links",
                "heading": "Community channels",
                "items": [
                    {"title": "Telegram group", "subtitle": "Chat with the community", "body_md": "", "url": TELEGRAM_URL},
                    {"title": "Mailing list", "subtitle": "Discussions and announcements", "body_md": "", "url": MAILING_LIST_URL},
                    {"title": "Matrix room", "subtitle": "#vglug:matrix.org", "body_md": "", "url": "https://matrix.to/#/#vglug:matrix.org"},
                    {"title": "vglug.org", "subtitle": "Blog, tutorials and e-books", "body_md": "", "url": "https://vglug.org/"},
                ],
            },
            {
                "anchor": "meet-us",
                "layout": "prose",
                "heading": "Meet us in person",
                "body_md": (
                    "The best way to meet the community is at one of our open meetups in Viluppuram. "
                    "[See upcoming meetups](/meetups)."
                ),
            },
        ],
    },
}

MAIN_NAV = [
    {"system_key": "home", "label": "Home"},
    {
        "system_key": "explore",
        "label": "Explore",
        "children": [
            {"system_key": "meetups", "label": "Meetups"},
            {"system_key": "events", "label": "Events"},
            {"system_key": "blogs", "label": "Blogs"},
        ],
    },
    {"system_key": "about", "label": "About Us"},
    {"system_key": "join", "label": "Join Us"},
    {"system_key": "contact", "label": "Contact Us"},
]

FOOTER_NAV = [
    {"label": "About Us", "url": "/about"},
    {"label": "Join Us", "url": "/join"},
    {"label": "Meetups", "url": "/meetups"},
    {"label": "Events", "url": "/events"},
    {"label": "Blogs", "url": "/blogs"},
    {"label": "Contact Us", "url": "/contact"},
    {"label": "Tutorials", "url": "https://vglug.org/category/tutorials/"},
    {"label": "Free e-books", "url": "https://vglug.org/category/free-ebooks/"},
]

FOOTER = {
    "org_name": ORG_NAME,
    "short_name": "VGLUG Foundation",
    "description": (
        "A non-profit Free and Open Source Software community started in 2013, working to take free software "
        "and its ideals to every corner of the country."
    ),
    # Coordinator number published on vglug.org. Email, address, registration ID and the
    # donation QR code are not published there and must be supplied through the admin panel.
    "phone": "+91 96775 04839",
    "copyright_text": f"{ORG_NAME} (VGLUG)",
}

SOCIAL_LINKS = [
    {"platform": "telegram", "url": TELEGRAM_URL, "label": "Telegram group"},
    {"platform": "youtube", "url": "https://www.youtube.com/channel/UCztecD7qSCgqcb59r0G3GHg", "label": "YouTube"},
    {"platform": "facebook", "url": "https://www.facebook.com/vpmglug/", "label": "Facebook"},
    {"platform": "instagram", "url": "https://www.instagram.com/vglug/", "label": "Instagram"},
    {"platform": "x", "url": "https://twitter.com/vpmglug", "label": "X (Twitter)"},
    {"platform": "linkedin", "url": "https://www.linkedin.com/company/vglug", "label": "LinkedIn"},
    {"platform": "github", "url": "https://github.com/ViluppuramGLUG/", "label": "GitHub"},
    {"platform": "gitlab", "url": "https://gitlab.com/villupuramglug/", "label": "GitLab"},
    {"platform": "matrix", "url": "https://matrix.to/#/#vglug:matrix.org", "label": "Matrix"},
]
