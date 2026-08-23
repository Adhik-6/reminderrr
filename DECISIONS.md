
This file should contain:
    1. What you chose
    2. What you rejected, and why
    3. What you cut for time
    4. What your solution does not do
    5. What you would fix first

# DECISIONS

## Tech Stack
1. **Backend**: **Pyhton** would have been a better option as the given simulation code (like `channels.py` & `demo.py`) was in python but i went with **Node.js with Express** as i was familiar with it and it is lightweight and easy to set up. I used **typescript** for better type safety over **JavaScript**.
2. **Database**: Although i was familiar with **MongoDB**, i chose **SQLite** for this project as it seemed to be the best option for a small projects where i need to get the project working quickly. Also, the given CSV data would fit really well in a relational database like SQLite. I rejected **PostgreSQL** and **MySQL** as they would consme lot of set up time and not so familiar with them. 3. **Queueing**: This is my first time using a queueing system, so i went with **BullMQ** as it seemed to have **built-in retries** and **delayed jobs**. 

## Architectural Decisions
