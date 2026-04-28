# Employee Scheduler

A simple employee scheduling app built with React, TypeScript, Vite, and Tailwind CSS.

## Features

- Generate weekly employee schedules
- 40 hours per employee per week
- 2 days off per employee
- 8-hour shift blocks
- Hourly coverage summary
- Overtime support
- Export schedule to Excel

## Schedule Logic

Each employee works:

- 5 working days
- 2 days off
- 8 hours per shift
- 40 hours total per week

The app tries to match hourly staffing demand across the week.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- XLSX
- Lucide React

## Live Demo

https://kukavigan.github.io/employee-scheduler/

## Run Locally

```bash
npm install
npm run dev
