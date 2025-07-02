# Dockerfile
FROM rust:latest

RUN apt-get update && apt-get install -y git clang cmake

WORKDIR /opt
RUN git clone https://github.com/ordinals/ord.git
WORKDIR /opt/ord
RUN cargo build --release

ENV PATH="/opt/ord/target/release:$PATH"
