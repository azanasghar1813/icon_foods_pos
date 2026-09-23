export const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

export const sendError = (res, statusCode, message, details = null) => {
  const response = {
    success: false,
    message,
    error: details
  };
  res.status(statusCode).json(response);
};
