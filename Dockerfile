FROM node:latest

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npm rebuild

# Copy the rest of the application code
COPY . .

RUN npx prisma generate

# Command to run the application
CMD ["npm", "start"]
