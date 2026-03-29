# Use Node.js 18 base image
FROM node:18-slim

# Install Python 3 and other necessary dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy backend package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Create and sync Python requirements
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy all backend source files
COPY . .

# Expose the API and Socket.io port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
