FROM eternalpersonalagi/node24-browser-use-template:latest

ENV DISPLAY=:99
ENV XDG_SESSION_TYPE=x11
ENV GDK_SCALE=1
ENV GDK_DPI_SCALE=1
ENV BROWSER_WINDOW_SIZE_WIDTH=1440
ENV BROWSER_WINDOW_SIZE_HEIGHT=1440
ENV SCREEN_COLOR_DEPTH_BITS=24
ENV NO_VNC_PORT=6080
ENV CHROME_DEBUG_PORT=9222

WORKDIR /app

# Copy package files
COPY ./package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY ./ ./

RUN npm run build
RUN npm rebuild sqlite3 --build-from-source

ENV STORAGE_PATH=/storage

EXPOSE 6080

# # Start the application
# CMD ["yarn", "start"]

CMD Xvfb "$DISPLAY" -screen 0 "${BROWSER_WINDOW_SIZE_WIDTH}x${BROWSER_WINDOW_SIZE_HEIGHT}x${SCREEN_COLOR_DEPTH_BITS}" -ac -nolisten tcp & \
    openbox --reconfigure && openbox-session & \
    bash scripts/x11-setup.sh & \
    x11vnc -display "$DISPLAY" -forever -shared -nopw -geometry "${BROWSER_WINDOW_SIZE_WIDTH}x${BROWSER_WINDOW_SIZE_HEIGHT}" -scale 1:1 -nomodtweak & \
    /opt/novnc/utils/novnc_proxy --vnc localhost:5900 --listen "$NO_VNC_PORT" & \
    yarn start