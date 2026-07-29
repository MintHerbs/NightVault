# Chapter 1: How the web works

*Week 1 · 2+1 hrs · Lab: PGP exercise (security)*

Reading: [MDN: How the web works](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works) · [MDN: How does the internet work](https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work)

## Case study: Sarah sends a text

Sarah is on a messaging app. She types a message to her ex: *"We're done. You're the worst person I've dated."* She hits send. That single tap sets off a chain of network steps most people never think about. Let's follow it, hop by hop.

### Step 1: DNS, finding the address

Sarah's phone doesn't know where "the messaging server" physically is. It only knows a domain name, e.g. `api.chatapp.com`. Computers route traffic using numbers, not names, so the phone asks a **DNS server** (Domain Name System) to translate the name into an **IP address**, e.g. `104.18.32.7`.

> **Analogy:** DNS is a phone book. You know a business by its name, DNS looks up the actual number to dial.

![Diagram: the DNS lookup](/notes/img/web/ch01-dns-lookup.svg)

### Step 2: IP addresses and packets

Data doesn't travel as one lump. It's chopped into small chunks called **packets**, each stamped with a source IP and a destination IP, like a shipping label. Packets can take different routes across different **routers** and get reassembled at the end, in order.

| Term | What it means |
| --- | --- |
| IPv4 | Address format like `104.18.32.7`. About 4 billion possible addresses, running out. |
| IPv6 | Newer format like `2606:4700::6810:2007`. Basically unlimited addresses. |
| Packet | A small chunk of data with a header, where it's from, where it's going. |
| Router | A device that looks at a packet's destination and forwards it toward the next hop. |

![Diagram: one message, three packets, different paths](/notes/img/web/ch01-packet-routing.svg)

### Step 3: TCP, the handshake

Before any message data is sent, Sarah's phone and the server agree to talk using **TCP** (Transmission Control Protocol). This is the three-way handshake:

![Diagram: the TCP three-way handshake](/notes/img/web/ch01-tcp-handshake.svg)

TCP guarantees packets arrive complete and in order. This matters, because if packets arrived scrambled, the server might read her message as garbage instead of an insult.

### Step 4: TLS, locking the envelope

Modern apps use **HTTPS**, which wraps the connection in **TLS** encryption. Phone and server swap keys and scramble the data so anyone snooping on the network, a coffee shop wifi, an ISP, sees gibberish, not "You're the worst person I've dated."

### Step 5: the HTTP request

Now the actual message is sent, as an HTTP request:

```http the request Sarah's phone sends
POST /messages/send HTTP/1.1
Host: api.chatapp.com
Content-Type: application/json

{ "to": "ex_id_92", "text": "We're done. You're the worst person I've dated." }
```

### Step 6: the CDN, on the way in

Before this request even reaches the main servers, it likely passes through a **CDN** (Content Delivery Network) edge node, a server geographically close to Sarah. CDNs mainly cache static files, images, app JS/CSS, so they load fast from nearby, instead of one distant server serving the whole planet. Not every request is cacheable, Sarah's message is unique and private, so it isn't cached, but the CDN still often acts as the first point of contact, forwarding dynamic requests onward to the real origin server.

![Diagram: CDN edge node vs the distant origin server](/notes/img/web/ch01-cdn-edge.svg)

### Step 7: load balancer and app server

The request lands on a **load balancer**, which spreads incoming traffic across many app servers so no single machine gets overwhelmed. One server picks it up, checks Sarah is logged in, and processes the request.

### Step 8: the database

The server saves the message as a row in a **database**, sender, receiver, text, timestamp. This is the permanent record. If the server crashed one second later, the message would still exist.

### Step 9: pushing it to the ex's phone

The ex isn't sitting there refreshing the app. Instead, the server tells a **push notification service**, like Apple's APNs or Google's FCM, to wake up the ex's phone. The ex's phone gets a notification, taps it, and the app makes its own GET request to fetch the new message from the server.

### Aside: what about crawlers?

A **web crawler**, like Googlebot, is a bot that visits public web pages to index them for search engines. Sarah's message is private, sent through an API, never a public page, so no crawler ever sees it. Crawlers only matter for public content, like a blog post or a company website.

## The whole trip, end to end

![Diagram: the full journey of Sarah's message](/notes/img/web/ch01-message-journey.svg)

All of this happens in well under a second. Every website you build this semester runs on this same foundation: DNS to find it, TCP/IP to move the bytes, HTTP to speak the same language, and a server plus database to store and answer.
